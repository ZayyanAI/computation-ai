"""
Stage 3: Detection & Segmentation Core.
Handles single primary object focus (for handheld/demonstrated items),
noise and non-object contour suppression (face, body, wrinkles, borders),
composite saliency scoring, and multi-object candidate management.

Detection sources:
  1. AI ("yolo_seg"): YOLOv8-seg instance segmentation masks when enabled and available.
  2. Classic ("classic_cv"): OpenCV contour/adaptive-threshold pipeline (automatic fallback).
"""
import time
import os
import cv2
import numpy as np
from typing import List, Dict, Any, Optional, Tuple

DEFAULT_AI_MODEL = "yolov8n-seg.pt"
COCO_EXCLUDE_CLASSES = {"person", "handbag", "backpack", "suitcase", "tie", "hat"}

class DetectionEngine:
    def __init__(self, ai_model: Optional[str] = None):
        # Load Haar Cascade for frontal face detection to suppress face/neck contours
        self.face_cascade = None
        try:
            cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
            self.face_cascade = cv2.CascadeClassifier(cascade_path)
        except Exception:
            pass
        # Lazy-loaded YOLO segmentation model (not imported until first use)
        self._ai_model = None
        self._ai_model_path = ai_model or DEFAULT_AI_MODEL
        # Lazy-loaded FastSAM class-agnostic segmentation fallback
        self._fastsam_model = None
        self._fastsam_path = "FastSAM-s.pt"

    def segment_objects(
        self,
        image: np.ndarray,
        config: Dict[str, Any],
        calib_result: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Try AI segmentation first (if enabled); fall back to the classic OpenCV
        contour pipeline when no candidates are produced or the model is unavailable.
        """
        use_ai = config.get("ai_detection", True)
        if use_ai:
            try:
                ai_out = self._segment_ai(image, config, calib_result)
                if ai_out.get("objects"):
                    return ai_out
            except Exception:
                # Model load/inference failure: transparently fall back to classic CV
                pass

        classic_out = self._segment_classic(image, config, calib_result)
        classic_out["detection_backend"] = "classic_cv"
        return classic_out

    def _load_ai_model(self) -> Any:
        """Load (or fetch) the YOLOv8-seg model once and cache it."""
        if self._ai_model is None:
            from ultralytics import YOLO
            self._ai_model = YOLO(self._ai_model_path)
        return self._ai_model

    def _segment_ai(
        self,
        image: np.ndarray,
        config: Dict[str, Any],
        calib_result: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Run YOLOv8-seg instance segmentation first; if no candidates survive,
        fall back to FastSAM (class-agnostic) so non-COCO objects such as an
        earphone case are still segmented. Then reuse the composite saliency /
        single-object selection logic."""
        h, w = image.shape[:2]
        target_obj = config.get("target_object", "benda")
        category = config.get("category", "general")
        single_object_mode = config.get("single_object_mode", True if category == "general" else False)
        selected_candidate_id = config.get("selected_candidate_id")
        exclude_classes = set(config.get("ai_exclude_classes") or COCO_EXCLUDE_CLASSES)
        device = config.get("ai_device", "cpu")
        conf_thres = float(config.get("ai_conf_thres", 0.25))
        iou_thres = float(config.get("ai_iou", 0.45))

        calib_center = calib_result.get("center") if calib_result else None
        calib_radius = calib_result.get("radius_px", 40) if calib_result else 40
        min_area = max(250, int((w * h) * 0.001))
        max_area = int((w * h) * 0.60)

        candidates = []
        cand_id = 1
        infer_ms = 0.0
        raw_detections = 0
        detection_backend = None
        detection_model = None

        # 1) YOLOv8-seg: class-aware, precise masks
        try:
            model = self._load_ai_model()
            t0 = time.time()
            results = model.predict(
                image, conf=conf_thres, iou=iou_thres,
                device=device, retina_masks=True, verbose=False
            )
            infer_ms += round((time.time() - t0) * 1000, 2)
            if results and results[0].masks is not None:
                r = results[0]
                names = r.names
                masks = r.masks.data   # (N, H, W) tensor in original image resolution
                xy_list = r.masks.xy   # list of per-instance polygons in original coords
                n = len(r.boxes) if r.boxes is not None else 0
                raw_detections = n
                detection_backend = "yolo_seg"
                detection_model = self._ai_model_path
                for j in range(n):
                    cls_id = int(r.boxes.cls[j].item())
                    cls_label = names.get(cls_id, "object")
                    if cls_label in exclude_classes:
                        continue
                    conf = float(r.boxes.conf[j].item())
                    poly = np.array(xy_list[j], dtype=np.float32).reshape(-1, 1, 2)
                    if poly.shape[0] < 5:
                        continue
                    mask_area_px = float(np.count_nonzero(masks[j].cpu().numpy() > 0.5))
                    cand = self._mask_candidate(
                        image, poly, conf, cls_label, "yolo_seg", mask_area_px,
                        config, calib_result, calib_center, calib_radius,
                        min_area, max_area, h, w, cand_id, compute_skin=False
                    )
                    if cand is None:
                        continue
                    cand["confidence"] = round(conf, 3)
                    candidates.append(cand)
                    cand_id += 1
        except Exception:
            pass

        # 2) FastSAM: class-agnostic fallback when YOLO produced nothing usable.
        #    Needed for objects absent from COCO (e.g. an earphone case on fabric).
        if not candidates and config.get("fastsam_fallback", True):
            try:
                fastsam = self._load_fastsam()
                t1 = time.time()
                fs_results = fastsam.predict(
                    image, conf=max(conf_thres, 0.10), iou=0.45,
                    device=device, retina_masks=True, verbose=False
                )
                infer_ms += round((time.time() - t1) * 1000, 2)
                if fs_results and fs_results[0].masks is not None:
                    r = fs_results[0]
                    masks = r.masks.data
                    xy_list = r.masks.xy
                    n = len(r.boxes) if r.boxes is not None else 0
                    raw_detections = n
                    detection_backend = "fastsam"
                    detection_model = self._fastsam_path
                    for j in range(n):
                        conf = float(r.boxes.conf[j].item())
                        poly = np.array(xy_list[j], dtype=np.float32).reshape(-1, 1, 2)
                        if poly.shape[0] < 5:
                            continue
                        mask_area_px = float(np.count_nonzero(masks[j].cpu().numpy() > 0.5))
                        cand = self._mask_candidate(
                            image, poly, conf, "segment", "fastsam", mask_area_px,
                            config, calib_result, calib_center, calib_radius,
                            min_area, max_area, h, w, cand_id, compute_skin=True
                        )
                        if cand is None:
                            continue
                        cand["confidence"] = round(cand["saliency_score"], 3)
                        candidates.append(cand)
                        cand_id += 1
            except Exception:
                pass

        out = self._finalize_candidates(candidates, target_obj, category, single_object_mode, selected_candidate_id)
        out["detection_backend"] = detection_backend or "yolo_seg"
        out["ai"] = {
            "model": detection_model or self._ai_model_path,
            "inference_ms": round(infer_ms, 2),
            "detections": raw_detections
        }
        return out

    def _load_fastsam(self) -> Any:
        """Load (or fetch) FastSAM-s once and cache it for class-agnostic fallback."""
        if self._fastsam_model is None:
            from ultralytics import YOLO
            self._fastsam_model = YOLO(self._fastsam_path)
        return self._fastsam_model

    def _color_uniformity_score(self, image: np.ndarray, poly: np.ndarray, max_std: float = 60.0) -> float:
        """Score how uniform / solid the color inside the contour is. Textured
        regions (e.g. striped fabric) get a low score, solid objects get ~1.0."""
        if image.ndim != 3:
            return 0.5
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        h, w = gray.shape
        mask_cnt = np.zeros((h, w), dtype=np.uint8)
        cv2.drawContours(mask_cnt, [poly.astype(np.int32)], -1, 255, -1)
        px = gray[mask_cnt > 0]
        if len(px) < 20:
            return 0.5
        std = float(np.std(px))
        return max(0.0, 1.0 - std / max_std)

    def _mask_candidate(
        self,
        image: np.ndarray,
        poly: np.ndarray,
        conf: float,
        cls_label: str,
        backend: str,
        mask_area_px: float,
        config: Dict[str, Any],
        calib_result: Optional[Dict[str, Any]],
        calib_center,
        calib_radius: float,
        min_area: int,
        max_area: int,
        h: int,
        w: int,
        cand_id: int,
        compute_skin: bool
    ) -> Optional[Dict[str, Any]]:
        """Shared geometry validation + composite-saliency scoring for mask-based
        candidates from YOLO or FastSAM."""
        target_obj = config.get("target_object", "benda")
        category = config.get("category", "general")

        contour_area_px = float(cv2.contourArea(poly))
        if contour_area_px < min_area or contour_area_px > max_area:
            return None

        M = cv2.moments(poly)
        if M["m00"] == 0:
            return None
        cx = float(M["m10"] / M["m00"])
        cy = float(M["m01"] / M["m00"])

        # Calibration marker overlap exclusion
        if calib_center:
            dist_to_calib = float(np.sqrt((cx - calib_center[0]) ** 2 + (cy - calib_center[1]) ** 2))
            calib_threshold = max(calib_radius * 1.6, float(calib_result.get("pixel_dimension", 40)) * 0.60)
            if dist_to_calib < calib_threshold:
                return None

        # Oriented minimum-area bounding box
        rect = cv2.minAreaRect(poly)
        rect_center, (rw, rh), angle = rect
        length_px = float(max(rw, rh))
        width_px = float(min(rw, rh))
        if length_px < 10 or width_px < 6:
            return None

        x, y, bw, bh = cv2.boundingRect(poly)
        if bw <= 1 or bh <= 1:
            return None

        # Frame boundary lines
        if (x <= 6 or y <= 6 or x + bw >= w - 6 or y + bh >= h - 6):
            if bw > 0.70 * w or bh > 0.70 * h or max(bw, bh) / max(min(bw, bh), 1) > 4.5:
                return None

        # Thin elongated strips (e.g. a fabric stripe) are not valid objects
        if length_px / max(width_px, 6.0) > 3.6 and width_px < 30:
            return None

        hull = cv2.convexHull(poly)
        hull_area = float(cv2.contourArea(hull))
        solidity = float(contour_area_px / max(hull_area, 1.0))
        if solidity < 0.45:
            return None

        peri_px = float(cv2.arcLength(poly, True))
        circularity = float((4.0 * np.pi * contour_area_px) / (peri_px ** 2)) if peri_px > 0 else 0.0
        circularity = min(1.0, max(0.0, circularity))

        # Solid-color bonus: striped / textured regions are penalized
        color_score = self._color_uniformity_score(image, poly)

        # Skin suppression (FastSAM / classic: class names unavailable)
        skin_ratio = 0.0
        if compute_skin and image.ndim == 3:
            mask_cnt = np.zeros((h, w), dtype=np.uint8)
            cv2.drawContours(mask_cnt, [poly.astype(np.int32)], -1, 255, -1)
            ycc = cv2.cvtColor(image, cv2.COLOR_BGR2YCR_CB)
            y_ch = ycc[..., 0]; cr = ycc[..., 1]; cb = ycc[..., 2]
            skin_px = np.sum(
                (cr >= 138) & (cr <= 178) & (cb >= 77) & (cb <= 127) &
                (y_ch >= 85) & (y_ch <= 240) & (mask_cnt > 0)
            )
            skin_ratio = float(skin_px / max(contour_area_px, 1.0))

        polygon_pts = self._smooth_polygon(poly, target_area=contour_area_px)
        box_corners = cv2.boxPoints(rect)
        box_pts = [[round(float(pt[0]), 1), round(float(pt[1]), 1)] for pt in box_corners]

        ellipse_info = None
        if len(poly) >= 5:
            try:
                (ecx, ecy), (d1, d2), e_angle = cv2.fitEllipse(poly)
                ellipse_info = {
                    "center": [float(ecx), float(ecy)],
                    "major_axis_px": float(max(d1, d2)),
                    "minor_axis_px": float(min(d1, d2)),
                    "angle": float(e_angle)
                }
            except Exception:
                pass

        # Composite saliency: prioritize centered, compact, solid-colored objects
        dist_center = np.sqrt(((cx - w / 2.0) / (w / 2.0)) ** 2 + ((cy - h / 2.0) / (h / 2.0)) ** 2)
        score_centrality = max(0.0, 1.0 - 0.70 * dist_center)
        area_ratio = contour_area_px / float(w * h)
        if area_ratio < 0.015:
            score_size = area_ratio / 0.015
        elif area_ratio <= 0.18:
            score_size = 1.0
        else:
            score_size = max(0.2, 1.0 - (area_ratio - 0.18) / 0.30)
        score_shape = 0.55 * solidity + 0.45 * min(1.0, circularity * 1.5)
        if calib_center:
            score_calib = max(0.0, 1.0 - (dist_to_calib / (max(w, h) * 0.6)))
        else:
            score_calib = 0.5
        score_nonskin = max(0.1, 1.0 - 0.75 * skin_ratio)
        saliency_score = round(
            0.25 * score_centrality +
            0.30 * score_shape +
            0.15 * score_size +
            0.15 * color_score +
            0.05 * score_calib +
            0.10 * score_nonskin,
            3
        )

        return {
            "id": cand_id,
            "candidate_id": cand_id,
            "label": f"{target_obj.capitalize()} #{cand_id}",
            "category": category,
            "ai_class": cls_label,
            "ai_backend": backend,
            "ai_conf": round(conf, 3),
            "confidence": round(conf, 3),
            "saliency_score": saliency_score,
            "centroid": [round(cx, 1), round(cy, 1)],
            "bbox": [x, y, bw, bh],
            "min_area_rect": {
                "center": [round(rect_center[0], 1), round(rect_center[1], 1)],
                "length_px": round(length_px, 2),
                "width_px": round(width_px, 2),
                "angle_deg": round(angle, 1),
                "corners": box_pts
            },
            "polygon": polygon_pts,
            "ellipse": ellipse_info,
            "pixel_metrics": {
                "length_px": round(length_px, 2),
                "width_px": round(width_px, 2),
                "area_px": round(contour_area_px, 2),
                "mask_area_px": round(mask_area_px, 2),
                "perimeter_px": round(peri_px, 2),
                "circularity": round(circularity, 3),
                "solidity": round(solidity, 3)
            },
            "is_primary": False
        }

    def _finalize_candidates(
        self,
        candidates: List[Dict[str, Any]],
        target_obj: str,
        category: str,
        single_object_mode: bool,
        selected_candidate_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """Shared candidate selection logic: composite-saliency ranking, primary
        object resolution, and single-vs-multi object output assembly."""
        candidates.sort(key=lambda c: c["saliency_score"], reverse=True)

        if not candidates:
            return {
                "objects": [],
                "candidate_objects": [],
                "primary_object_id": None,
                "single_object_mode": single_object_mode
            }

        primary_idx = 0
        if selected_candidate_id is not None:
            for idx, c in enumerate(candidates):
                if c["candidate_id"] == selected_candidate_id:
                    primary_idx = idx
                    break

        for idx, c in enumerate(candidates):
            c["is_primary"] = (idx == primary_idx)
            c["rank"] = idx + 1

        primary_candidate = candidates[primary_idx]
        primary_candidate["id"] = 1
        primary_candidate["label"] = f"Objek Utama #1"

        if single_object_mode:
            output_objects = [primary_candidate]
        else:
            output_objects = []
            for idx, c in enumerate(candidates, 1):
                c_copy = c.copy()
                c_copy["id"] = idx
                c_copy["label"] = f"{target_obj.capitalize()} #{idx}"
                output_objects.append(c_copy)

        return {
            "objects": output_objects,
            "candidate_objects": candidates,
            "primary_object_id": primary_candidate["candidate_id"],
            "single_object_mode": single_object_mode
        }

    def _segment_classic(
        self, 
        image: np.ndarray, 
        config: Dict[str, Any], 
        calib_result: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Extracts foreground objects, suppresses non-object noise (wrinkles, face, body),
        computes composite saliency scores, and focuses on the single primary demonstrated object.
        """
        h, w = image.shape[:2]
        target_obj = config.get("target_object", "benda")
        category = config.get("category", "general")
        single_object_mode = config.get(
            "single_object_mode", 
            True if category == "general" else False
        )
        selected_candidate_id = config.get("selected_candidate_id")

        # 1. Edge-preserving Preprocessing (Bilateral Filter + CLAHE)
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
        filtered = cv2.bilateralFilter(gray, d=7, sigmaColor=60, sigmaSpace=60)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(filtered)

        is_general = category == "general"

        # 2. Detect Faces for Human Body/Head Suppression
        faces = ()
        if self.face_cascade:
            try:
                faces = self.face_cascade.detectMultiScale(
                    gray, scaleFactor=1.15, minNeighbors=3, minSize=(60, 60)
                )
            except Exception:
                faces = ()

        # 3. Category-Adaptive Thresholding & Foreground Extraction
        if category == "cell":
            _, thresh = cv2.threshold(enhanced, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
            if np.mean(thresh) > 180:
                thresh = cv2.bitwise_not(thresh)
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
            thresh = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel, iterations=1)
            contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        elif category in ["fruit", "box", "vehicle", "part"]:
            _, thresh = cv2.threshold(enhanced, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
            if np.mean(thresh) > 180:
                thresh = cv2.bitwise_not(thresh)
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
            thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel, iterations=2)
            thresh = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel, iterations=1)
            contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        else:
            # General / Live Camera / Handheld Object Mode:
            # Adaptive Gaussian thresholding to cleanly isolate foreground object silhouettes
            thresh_adapt = cv2.adaptiveThreshold(
                filtered, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 21, 4
            )
            k_clean = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
            thresh = cv2.morphologyEx(thresh_adapt, cv2.MORPH_OPEN, k_clean, iterations=1)
            # Find contours with RETR_LIST so internal objects held in front of torso/clothing are found
            contours, _ = cv2.findContours(thresh, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)

            # Handheld bright-object channel: bright foreground minus dilated skin.
            # When a bright wall/background connects with the palm, global thresholding merges the
            # held object into one giant blob; erasing skin keeps only the non-skin bright item held
            # in the hand (e.g. white AirPods case) while border-touching background is discarded.
            if is_general:
                skin_mask = self._compute_skin_mask(image)
                skin_dilated = cv2.morphologyEx(
                    skin_mask,
                    cv2.MORPH_DILATE,
                    cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)),
                    iterations=2
                )
                otsu_thr, _ = cv2.threshold(enhanced, 0, 255, cv2.THRESH_OTSU)
                bright_fg = (enhanced > max(int(otsu_thr), 140)).astype(np.uint8)
                bright_fg = cv2.bitwise_and(bright_fg, cv2.bitwise_not(skin_dilated))
                bright_fg = cv2.morphologyEx(bright_fg, cv2.MORPH_OPEN, k_clean, iterations=1)
                bright_fg = cv2.morphologyEx(bright_fg, cv2.MORPH_CLOSE, k_clean, iterations=2)
                bright_contours = self._extract_object_contours(bright_fg, w, h)
                contours = list(contours) + bright_contours

        # Calibration Marker Center & Radius for Marker Filtering
        calib_center = calib_result.get("center") if calib_result else None
        calib_radius = calib_result.get("radius_px", 40) if calib_result else 40

        # Minimum area threshold: discard microscopic specks (except in cell microscopy mode)
        if category == "cell":
            min_area = max(40, int((w * h) * 0.0001))
        else:
            min_area = max(250, int((w * h) * 0.001))
        max_area = int((w * h) * 0.60)

        # Deduplicate overlapping contours only for the general handheld path
        # (two segmentation channels merged); other categories use a single channel.
        if is_general:
            contours = self._dedupe_contours(contours)

        # Prepare Skin Detection Color Space for Human Hand/Body Penalization
        img_ycrcb = cv2.cvtColor(image, cv2.COLOR_BGR2YCR_CB) if len(image.shape) == 3 else None

        candidates = []
        cand_id = 1

        for cnt in contours:
            area_px = cv2.contourArea(cnt)
            if area_px < min_area or area_px > max_area:
                continue

            x, y, bw, bh = cv2.boundingRect(cnt)

            # A. Reject frame boundary lines & canvas edge artifacts
            if (x <= 6 or y <= 6 or x + bw >= w - 6 or y + bh >= h - 6):
                if bw > 0.70 * w or bh > 0.70 * h or max(bw, bh) / max(min(bw, bh), 1) > 4.5:
                    continue

            # B. Solidity Filter: reject hollow loops, open collar folds, and fabric wrinkles
            hull = cv2.convexHull(cnt)
            hull_area = cv2.contourArea(hull)
            solidity = float(area_px / max(hull_area, 1.0))
            if solidity < 0.50:
                continue

            # Centroid via Spatial Moments
            M = cv2.moments(cnt)
            if M["m00"] == 0:
                continue
            cx = float(M["m10"] / M["m00"])
            cy = float(M["m01"] / M["m00"])

            # C. Check if contour overlaps calibration marker (coin, credit card, or aruco)
            dist_to_calib = 0.0
            if calib_center:
                dist_to_calib = float(np.sqrt((cx - calib_center[0])**2 + (cy - calib_center[1])**2))
                calib_threshold = max(calib_radius * 1.6, float(calib_result.get("pixel_dimension", 40)) * 0.60)
                if dist_to_calib < calib_threshold:
                    continue

            # D. Oriented Minimum-Area Bounding Box
            rect = cv2.minAreaRect(cnt)
            rect_center, (rw, rh), angle = rect
            length_px = float(max(rw, rh))
            width_px = float(min(rw, rh))

            if length_px < 10 or width_px < 6:
                continue

            # E. Thin Line Filter: reject fabric creases, hair strands, and seams
            aspect_ratio = length_px / max(width_px, 1.0)
            if aspect_ratio > 3.6 and width_px < 30.0:
                continue

            # F. Face & Head Exclusion: reject contours located directly inside detected face or neck
            is_face_region = False
            for (fx, fy, fw, fh) in faces:
                if (fx - 20 <= cx <= fx + fw + 20) and (fy - 20 <= cy <= fy + int(fh * 1.35)):
                    is_face_region = True
                    break
            if is_face_region:
                continue

            # G. Skin Color Ratio Evaluation
            # Active for the handheld 'general' category; hands/arms must be excluded even
            # when no face is visible. A luminance gate (Y >= 85) prevents dark-red and brown
            # products (balls, cardboard, wood) from being misclassified as human skin.
            skin_ratio = 0.0
            if is_general and img_ycrcb is not None:
                mask_cnt = np.zeros(gray.shape, dtype=np.uint8)
                cv2.drawContours(mask_cnt, [cnt], -1, 255, -1)
                y_ch = img_ycrcb[:, :, 0]
                cr = img_ycrcb[:, :, 1]
                cb = img_ycrcb[:, :, 2]
                skin_pixels = np.sum(
                    (cr >= 138) & (cr <= 178) & (cb >= 77) & (cb <= 127) &
                    (y_ch >= 85) & (y_ch <= 240) & (mask_cnt > 0)
                )
                skin_ratio = float(skin_pixels / max(area_px, 1.0))
                # Reject if predominantly bare skin (hands, arms, chest, neck)
                if skin_ratio > 0.68:
                    continue

            # Perimeter & Circularity
            peri_px = float(cv2.arcLength(cnt, True))
            circularity = float((4.0 * np.pi * area_px) / (peri_px ** 2)) if peri_px > 0 else 0.0
            circularity = min(1.0, max(0.0, circularity))

            # High-precision approximate polygon for SVG rendering.
            # Small epsilon keeps the contour following the rounded/organic shape faithfully
            # (a large epsilon collapses ovals into coarse diamond-like polygons).
            epsilon = 0.002 * peri_px
            approx = cv2.approxPolyDP(cnt, epsilon, True)
            polygon_pts = self._smooth_polygon(approx, target_area=area_px)

            box_corners = cv2.boxPoints(rect)
            box_pts = [[round(float(pt[0]), 1), round(float(pt[1]), 1)] for pt in box_corners]

            # Fit ellipse if at least 5 points
            ellipse_info = None
            if len(cnt) >= 5:
                try:
                    (ecx, ecy), (d1, d2), e_angle = cv2.fitEllipse(cnt)
                    ellipse_info = {
                        "center": [float(ecx), float(ecy)],
                        "major_axis_px": float(max(d1, d2)),
                        "minor_axis_px": float(min(d1, d2)),
                        "angle": float(e_angle)
                    }
                except Exception:
                    pass

            # --- COMPOSITE SALIENCY SCORING (For Primary Object Selection) ---
            # 1. Centrality: distance from image center (held objects are centered)
            dist_center = np.sqrt(((cx - w / 2.0) / (w / 2.0)) ** 2 + ((cy - h / 2.0) / (h / 2.0)) ** 2)
            score_centrality = max(0.0, 1.0 - 0.70 * dist_center)

            # 2. Prominence / Size: optimal handheld item is 1.5% - 20% of frame area
            area_ratio = area_px / float(w * h)
            if area_ratio < 0.015:
                score_size = area_ratio / 0.015
            elif area_ratio <= 0.18:
                score_size = 1.0
            else:
                score_size = max(0.2, 1.0 - (area_ratio - 0.18) / 0.30)

            # 3. Shape Compactness: solid objects with high solidity & moderate circularity
            score_shape = 0.55 * solidity + 0.45 * min(1.0, circularity * 1.5)

            # 4. Color Uniformity: penalize textured / striped fabric backgrounds
            score_color = self._color_uniformity_score(image, cnt)

            # 5. Calibration Proximity
            if calib_center:
                score_calib = max(0.0, 1.0 - (dist_to_calib / (max(w, h) * 0.6)))
            else:
                score_calib = 0.5

            # 6. Non-Skin Bonus (distinct handheld items vs bare hands)
            score_nonskin = max(0.1, 1.0 - 0.75 * skin_ratio)

            # Weighted composite score: prioritize centered, compact, solid-colored objects
            composite_score = round(
                0.25 * score_centrality +
                0.30 * score_shape +
                0.15 * score_size +
                0.15 * score_color +
                0.05 * score_calib +
                0.10 * score_nonskin,
                3
            )

            candidates.append({
                "id": cand_id,
                "candidate_id": cand_id,
                "label": f"{target_obj.capitalize()} #{cand_id}",
                "category": category,
                "confidence": composite_score,
                "saliency_score": composite_score,
                "centroid": [round(cx, 1), round(cy, 1)],
                "bbox": [x, y, bw, bh],
                "min_area_rect": {
                    "center": [round(rect_center[0], 1), round(rect_center[1], 1)],
                    "length_px": round(length_px, 2),
                    "width_px": round(width_px, 2),
                    "angle_deg": round(angle, 1),
                    "corners": [[round(pt[0], 1), round(pt[1], 1)] for pt in box_pts]
                },
                "polygon": polygon_pts,
                "ellipse": ellipse_info,
                "pixel_metrics": {
                    "length_px": round(length_px, 2),
                    "width_px": round(width_px, 2),
                    "area_px": round(float(area_px), 2),
                    "perimeter_px": round(peri_px, 2),
                    "circularity": round(circularity, 3),
                    "solidity": round(solidity, 3)
                },
                "is_primary": False
            })
            cand_id += 1

        # Shared sort / primary selection / single vs multi assembly
        return self._finalize_candidates(
            candidates, target_obj, category, single_object_mode, selected_candidate_id
        )

    def _compute_skin_mask(self, image: np.ndarray) -> np.ndarray:
        """YCbCr skin segmentation mask (Cr 138-178, Cb 77-127) gated by a mid-bright
        luminance band so dark-red/brown objects (balls, boxes) are not mistaken for skin."""
        ycc = cv2.cvtColor(image, cv2.COLOR_BGR2YCR_CB)
        y = ycc[:, :, 0]
        cr = ycc[:, :, 1]
        cb = ycc[:, :, 2]
        mask = (((cr >= 138) & (cr <= 178) & (cb >= 77) & (cb <= 127) & (y >= 85) & (y <= 240)).astype(np.uint8)) * 255
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=1)
        return mask

    def _extract_object_contours(self, mask: np.ndarray, w: int, h: int) -> List[np.ndarray]:
        """Extract clean foreground contours, dropping background components that touch the
        frame border or that would dominate the frame (e.g. a connected bright wall)."""
        n, labels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
        cleaned = np.zeros_like(mask)
        max_component = int((w * h) * 0.12)
        for i in range(1, n):
            x, y, bw, bh, area = stats[i]
            touches = (x <= 6 or y <= 6 or x + bw >= w - 6 or y + bh >= h - 6)
            if touches or area > max_component or area < 150:
                continue
            cleaned[labels == i] = 255
        contours, _ = cv2.findContours(cleaned, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        return list(contours)

    def _smooth_polygon(self, approx: np.ndarray, target_area: float, max_points: int = 220) -> List[List[float]]:
        """Round the coarse approx polygon into a smooth curved outline while preserving area.

        Straight polygon vertices (which can look like a diamond for round/handheld objects)
        are converted into smooth curves via Chaikin corner cutting, then uniformly scaled
        about their centroid so the smoothed polygon keeps roughly the same enclosed area as
        the original contour.
        """
        pts = np.asarray(approx, dtype=np.float64).reshape(-1, 2)
        if len(pts) < 3:
            return [[round(float(pts[i][0]), 1), round(float(pts[i][1]), 1)] for i in range(len(pts))]

        def chaikin(poly: np.ndarray, iterations: int = 3) -> np.ndarray:
            p = poly.copy()
            for _ in range(iterations):
                n = len(p) - 1
                out = []
                for i in range(n):
                    a, b = p[i], p[i + 1]
                    out.append(0.75 * a + 0.25 * b)
                    out.append(0.25 * a + 0.75 * b)
                p = np.array(out)
                p = np.vstack([p, p[0]])
            return p[:-1]

        closed = np.vstack([pts, pts[0]])
        smooth = chaikin(closed, iterations=3)

        if len(smooth) > max_points:
            indices = np.linspace(0, len(smooth) - 1, max_points).astype(np.int64)
            smooth = smooth[indices]

        def shoelace(poly: np.ndarray) -> float:
            x = poly[:, 0]
            y = poly[:, 1]
            return 0.5 * abs(np.dot(x, np.roll(y, 1)) - np.dot(y, np.roll(x, 1)))

        area_smooth = shoelace(smooth)
        if area_smooth > 1e-6 and target_area > 1e-6:
            scale = np.sqrt(float(target_area) / area_smooth)
            if 0.85 <= scale <= 1.20:
                cx = float(np.mean(smooth[:, 0]))
                cy = float(np.mean(smooth[:, 1]))
                smooth = (smooth - np.array([cx, cy])) * scale + np.array([cx, cy])

        return [[round(float(p[0]), 1), round(float(p[1]), 1)] for p in smooth]

    def _dedupe_contours(self, contours: List[np.ndarray]) -> List[np.ndarray]:
        """Remove overlapping duplicates produced by different segmentation channels."""
        kept = []
        for cnt in contours:
            M = cv2.moments(cnt)
            if M["m00"] == 0:
                continue
            cx = M["m10"] / M["m00"]
            cy = M["m01"] / M["m00"]
            area = M["m00"]
            idx = None
            for i, (kcx, kcy, _karea, _kcnt) in enumerate(kept):
                if (kcx - cx) ** 2 + (kcy - cy) ** 2 < 400:
                    idx = i
                    break
            if idx is None:
                kept.append((cx, cy, area, cnt))
            elif area > kept[idx][2]:
                kept[idx] = (cx, cy, area, cnt)
        return [k[3] for k in kept]

