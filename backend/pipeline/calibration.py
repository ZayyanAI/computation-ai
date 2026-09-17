"""
Stage 2: Preprocessing & Calibration Engine.
Calculates pixel-to-metric scale ratio S = D_real / d_px using:
- ArUco Markers
- Circular Reference (Coin)
- Rectangular Reference (Credit/ID Card)
- Interactive 2-Point Manual Line
"""
import cv2
import numpy as np
from typing import Dict, Any, Tuple, Optional

def convert_mm_to_unit(val_mm: float, unit: str) -> float:
    if unit == "mm":
        return val_mm
    elif unit == "cm":
        return val_mm / 10.0
    elif unit == "m":
        return val_mm / 1000.0
    elif unit in ["in", "inch"]:
        return val_mm / 25.4
    return val_mm / 10.0

def get_unit_latex(unit: str) -> str:
    if unit == "mm":
        return r"\text{mm}"
    elif unit == "cm":
        return r"\text{cm}"
    elif unit == "m":
        return r"\text{m}"
    elif unit in ["in", "inch"]:
        return r"\text{in}"
    return r"\text{cm}"

class CalibrationEngine:
    def __init__(self):
        # Setup ArUco dictionary if available in opencv
        self.aruco_dict = None
        self.aruco_params = None
        try:
            if hasattr(cv2, 'aruco'):
                if hasattr(cv2.aruco, 'getPredefinedDictionary'):
                    self.aruco_dict = cv2.aruco.getPredefinedDictionary(cv2.aruco.DICT_4X4_50)
                    self.aruco_params = cv2.aruco.DetectorParameters()
                elif hasattr(cv2.aruco, 'Dictionary_get'):
                    self.aruco_dict = cv2.aruco.Dictionary_get(cv2.aruco.DICT_4X4_50)
                    self.aruco_params = cv2.aruco.DetectorParameters_create()
        except Exception:
            pass

    def detect_aruco(self, image: np.ndarray, real_size_mm: float = 50.0, unit: str = "cm") -> Optional[Dict[str, Any]]:
        """Detects ArUco marker and computes pixel scale."""
        if self.aruco_dict is None:
            return None
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
        
        try:
            if hasattr(cv2.aruco, 'ArucoDetector'):
                detector = cv2.aruco.ArucoDetector(self.aruco_dict, self.aruco_params)
                corners, ids, _ = detector.detectMarkers(gray)
            else:
                corners, ids, _ = cv2.aruco.detectMarkers(gray, self.aruco_dict, parameters=self.aruco_params)
            
            if ids is not None and len(corners) > 0:
                c = corners[0][0]  # First detected marker corners
                # Side lengths in pixels
                side1 = np.linalg.norm(c[0] - c[1])
                side2 = np.linalg.norm(c[1] - c[2])
                side3 = np.linalg.norm(c[2] - c[3])
                side4 = np.linalg.norm(c[3] - c[0])
                # Check keystone perspective tilt on ArUco marker
                side_min = min(side1, side2, side3, side4)
                side_max = max(side1, side2, side3, side4)
                ratio = side_min / max(side_max, 1e-3)
                tilt_angle_deg = round(float(np.degrees(np.arccos(min(1.0, max(0.1, ratio))))), 1)
                tilt_warning = tilt_angle_deg > 14.0
                accuracy_grade = "Tinggi (Tegak lurus)" if tilt_angle_deg <= 10.0 else (
                    "Sedang (Kemiringan terdeteksi)" if tilt_angle_deg <= 20.0 else "Rendah (Sudut miring)"
                )
                
                return {
                    "type": "aruco",
                    "marker_id": int(ids[0][0]),
                    "pixel_dimension": avg_side_px,
                    "real_dimension": real_size,
                    "unit": unit,
                    "scale": scale,  # unit per pixel
                    "corners": c.tolist(),
                    "center": [center_x, center_y],
                    "confidence": 0.99,
                    "subpixel_refined": True,
                    "tilt_angle_deg": tilt_angle_deg,
                    "tilt_warning": tilt_warning,
                    "coplanar_assumed": True,
                    "accuracy_grade": accuracy_grade
                }
        except Exception as e:
            print(f"ArUco error: {e}")
        return None

    def detect_circular_reference(self, image: np.ndarray, real_diameter_mm: float = 27.0, unit: str = "cm", roi: Optional[Tuple[int, int, int, int]] = None) -> Optional[Dict[str, Any]]:
        """
        Detects circular reference object (e.g. 500 IDR or US Quarter coin)
        Uses HoughCircles as coarse locator, then performs sub-pixel contour ROI
        extraction and ellipse fitting to determine exact major/minor axes and camera tilt.
        """
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
        blurred = cv2.GaussianBlur(gray, (7, 7), 1.5)
        
        h, w = gray.shape
        min_radius = int(min(h, w) * 0.02)
        max_radius = int(min(h, w) * 0.25)
        
        circles = cv2.HoughCircles(
            blurred, 
            cv2.HOUGH_GRADIENT, 
            dp=1.2, 
            minDist=int(min(h, w) * 0.1),
            param1=100, 
            param2=35, 
            minRadius=min_radius, 
            maxRadius=max_radius
        )
        
        edges_full = cv2.Canny(blurred, 60, 160)

        if circles is not None:
            circles = np.uint16(np.around(circles))
            best_candidate = None
            highest_score = 0.0

            for (cx, cy, r) in circles[0, :]:
                cx, cy, r = int(cx), int(cy), int(r)
                if cx - r < 0 or cx + r >= w or cy - r < 0 or cy + r >= h:
                    continue

                # 1. Circumference Edge Coverage Verification
                num_pts = 32
                thetas = np.linspace(0, 2 * np.pi, num_pts, endpoint=False)
                xs = np.clip((cx + r * np.cos(thetas)).astype(np.int32), 0, w - 1)
                ys = np.clip((cy + r * np.sin(thetas)).astype(np.int32), 0, h - 1)
                
                # Check how many points lie on high gradient edges (with 2px tolerance)
                edge_hits = 0
                for px, py in zip(xs, ys):
                    patch = edges_full[max(0, py-1):min(h, py+2), max(0, px-1):min(w, px+2)]
                    if np.any(patch > 0):
                        edge_hits += 1
                
                edge_coverage = edge_hits / float(num_pts)
                # Clothing folds typically only have edge on one side (< 30%)
                if edge_coverage < 0.42:
                    continue

                # 2. Sub-pixel ROI extraction for edge-refined ellipse fitting
                pad = int(r * 0.35)
                x0 = max(0, cx - r - pad)
                y0 = max(0, cy - r - pad)
                x1 = min(w, cx + r + pad)
                y1 = min(h, cy + r + pad)

                roi_gray = gray[y0:y1, x0:x1]
                if roi_gray.shape[0] < 12 or roi_gray.shape[1] < 12:
                    continue

                roi_blur = cv2.GaussianBlur(roi_gray, (5, 5), 0)
                roi_edges = cv2.Canny(roi_blur, 50, 150)
                contours, _ = cv2.findContours(roi_edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
                
                expected_area = np.pi * (r ** 2)
                best_cnt = None
                min_diff = float('inf')

                for cnt in contours:
                    if len(cnt) >= 8:
                        area = cv2.contourArea(cnt)
                        if 0.4 * expected_area < area < 1.8 * expected_area:
                            diff = abs(area - expected_area)
                            if diff < min_diff:
                                min_diff = diff
                                best_cnt = cnt

                if best_cnt is not None and len(best_cnt) >= 6:
                    try:
                        (ecx, ecy), (d1, d2), angle = cv2.fitEllipse(best_cnt)
                        d_major = max(d1, d2)
                        d_minor = min(d1, d2)

                        if d_major > 0 and 0.6 * (2 * r) < d_major < 1.6 * (2 * r):
                            aspect_ratio = float(d_minor / d_major)
                            # Only accept if reasonably circular (aspect ratio > 0.68)
                            if aspect_ratio >= 0.68:
                                score = edge_coverage * 0.5 + aspect_ratio * 0.5
                                if score > highest_score:
                                    highest_score = score
                                    cos_theta = min(1.0, max(0.1, aspect_ratio))
                                    tilt_deg = round(float(np.degrees(np.arccos(cos_theta))), 1)
                                    best_candidate = {
                                        "center": [round(float(x0 + ecx), 2), round(float(y0 + ecy), 2)],
                                        "radius_px": round(float(d_major / 2.0), 2),
                                        "pixel_dimension": round(float(d_major), 2),
                                        "tilt_angle_deg": tilt_deg,
                                        "subpixel_refined": True
                                    }
                    except Exception:
                        pass

            if best_candidate is not None:
                real_diam = convert_mm_to_unit(real_diameter_mm, unit)
                diameter_px = best_candidate["pixel_dimension"]
                scale = real_diam / diameter_px
                tilt_warning = best_candidate["tilt_angle_deg"] > 14.0
                accuracy_grade = "Tinggi (Tegak lurus)" if best_candidate["tilt_angle_deg"] <= 10.0 else (
                    "Sedang (Kemiringan terdeteksi)" if best_candidate["tilt_angle_deg"] <= 20.0 else "Rendah (Sudut miring)"
                )

                return {
                    "type": "coin",
                    "center": best_candidate["center"],
                    "radius_px": best_candidate["radius_px"],
                    "pixel_dimension": diameter_px,
                    "real_dimension": real_diam,
                    "unit": unit,
                    "scale": scale,
                    "confidence": 0.98,
                    "subpixel_refined": True,
                    "tilt_angle_deg": best_candidate["tilt_angle_deg"],
                    "tilt_warning": tilt_warning,
                    "coplanar_assumed": True,
                    "accuracy_grade": accuracy_grade
                }
        return None

    def detect_card_reference(self, image: np.ndarray, real_width_mm: float = 85.60, unit: str = "cm") -> Optional[Dict[str, Any]]:
        """
        Detects credit/ID card reference with aspect ratio ~ 85.60 / 53.98 = 1.586
        Refines corner coordinates with sub-pixel precision and computes perspective convergence.
        """
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        edges = cv2.Canny(blurred, 50, 150)
        
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 30, 0.01)

        for cnt in contours:
            peri = cv2.arcLength(cnt, True)
            approx = cv2.approxPolyDP(cnt, 0.03 * peri, True)
            if len(approx) == 4 and cv2.contourArea(cnt) > 2000:
                rect = cv2.minAreaRect(cnt)
                w_px = max(rect[1][0], rect[1][1])
                h_px = min(rect[1][0], rect[1][1])
                if h_px > 0:
                    aspect = w_px / h_px
                    if 1.35 <= aspect <= 1.85:
                        real_w = convert_mm_to_unit(real_width_mm, unit)
                        corners = approx.reshape(-1, 2).astype(np.float32)

                        # Sub-pixel corner refinement
                        try:
                            refined_corners = cv2.cornerSubPix(gray, corners, (5, 5), (-1, -1), criteria)
                            corners = refined_corners
                        except Exception:
                            pass

                        # Sort corners in clockwise order
                        center = np.mean(corners, axis=0)
                        angles = np.arctan2(corners[:, 1] - center[1], corners[:, 0] - center[0])
                        corners = corners[np.argsort(angles)]

                        # Estimate perspective keystone (ratio of opposite sides)
                        d01 = float(np.linalg.norm(corners[0] - corners[1]))
                        d12 = float(np.linalg.norm(corners[1] - corners[2]))
                        d23 = float(np.linalg.norm(corners[2] - corners[3]))
                        d30 = float(np.linalg.norm(corners[3] - corners[0]))

                        side_a1, side_a2 = max(d01, d23), min(d01, d23)
                        side_b1, side_b2 = max(d12, d30), min(d12, d30)

                        keystone_ratio = min(side_a2 / max(side_a1, 1e-3), side_b2 / max(side_b1, 1e-3))
                        tilt_angle_deg = round(float(np.degrees(np.arccos(min(1.0, max(0.1, keystone_ratio))))), 1)
                        tilt_warning = tilt_angle_deg > 14.0

                        # Use unforeshortened maximum width for scale
                        long_side = max(d01, d12, d23, d30)
                        scale = real_w / long_side

                        accuracy_grade = "Tinggi (Tegak lurus)" if tilt_angle_deg <= 10.0 else (
                            "Sedang (Kemiringan terdeteksi)" if tilt_angle_deg <= 20.0 else "Rendah (Sudut miring)"
                        )

                        return {
                            "type": "credit_card",
                            "center": [float(round(rect[0][0], 2)), float(round(rect[0][1], 2))],
                            "pixel_dimension": round(float(long_side), 2),
                            "real_dimension": real_w,
                            "unit": unit,
                            "scale": scale,
                            "corners": [[round(float(pt[0]), 2), round(float(pt[1]), 2)] for pt in corners],
                            "confidence": 0.95,
                            "subpixel_refined": True,
                            "tilt_angle_deg": tilt_angle_deg,
                            "tilt_warning": tilt_warning,
                            "coplanar_assumed": True,
                            "accuracy_grade": accuracy_grade
                        }
        return None

    def manual_2point_calibration(self, pt1: Tuple[float, float], pt2: Tuple[float, float], real_distance: float, unit: str = "cm") -> Dict[str, Any]:
        """Calculates scale from user specified 2 points."""
        dx = pt2[0] - pt1[0]
        dy = pt2[1] - pt1[1]
        dist_px = float(np.sqrt(dx*dx + dy*dy))
        dist_px = max(dist_px, 1.0)
        scale = real_distance / dist_px
        
        return {
            "type": "manual_ruler",
            "pt1": pt1,
            "pt2": pt2,
            "pixel_dimension": dist_px,
            "real_dimension": real_distance,
            "unit": unit,
            "scale": scale,
            "confidence": 1.0,
            "subpixel_refined": True,
            "tilt_angle_deg": 0.0,
            "tilt_warning": False,
            "coplanar_assumed": True,
            "accuracy_grade": "Tinggi (Manual)"
        }

    def calibrate(self, image: np.ndarray, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Master calibration dispatcher:
        Tries user specified strategy first; falls back to automatic detection or default ratio.
        """
        calib_type = config.get("calibration_type", "coin_idr500")
        unit = config.get("unit", "cm")
        real_size_mm = float(config.get("reference_real_size_mm", 27.0))
        
        calib_result = None
        
        # 1. Check manual 2-point if coordinates provided
        if calib_type == "manual_ruler" and "manual_pts" in config:
            pts = config["manual_pts"]
            if len(pts) >= 2:
                real_dist = convert_mm_to_unit(real_size_mm, unit)
                calib_result = self.manual_2point_calibration(tuple(pts[0]), tuple(pts[1]), real_dist, unit)

        # 2. ArUco
        if calib_result is None and calib_type == "aruco":
            calib_result = self.detect_aruco(image, real_size_mm, unit)

        # 3. Card
        if calib_result is None and calib_type == "credit_card":
            calib_result = self.detect_card_reference(image, real_size_mm, unit)

        # 4. Coin
        if calib_result is None and ("coin" in calib_type or calib_type == "auto"):
            calib_result = self.detect_circular_reference(image, real_size_mm, unit)

        # 5. Try any other reference if specific failed
        if calib_result is None and calib_type != "manual_ruler":
            # Auto fallback search
            calib_result = self.detect_aruco(image, 50.0, unit)
            if calib_result is None:
                calib_result = self.detect_circular_reference(image, 27.0, unit)

        # 6. Fallback default scale if no reference object in frame (e.g. 1 px = 0.05 cm)
        if calib_result is None:
            h, w = image.shape[:2]
            # Assume image width corresponds to ~30 cm view field as typical baseline
            default_real_w = convert_mm_to_unit(300.0, unit)
            default_scale = default_real_w / float(w)
            calib_result = {
                "type": "estimated_fov",
                "pixel_dimension": float(w),
                "real_dimension": default_real_w,
                "unit": unit,
                "scale": default_scale,
                "is_fallback": True,
                "confidence": 0.65,
                "subpixel_refined": False,
                "tilt_angle_deg": 0.0,
                "tilt_warning": False,
                "coplanar_assumed": True,
                "accuracy_grade": "Estimasi (Tanpa referensi)"
            }

        return calib_result
