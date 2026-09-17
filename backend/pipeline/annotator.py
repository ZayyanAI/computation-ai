"""
Stage 7: Visual Annotator.
Draws precise oriented bounding boxes, contour outlines, measurement labels,
and calibration reference tags directly onto the image frame with design system palette.
"""
import cv2
import numpy as np
import base64
from typing import Dict, Any, List, Optional

# Harmonious design system palette in BGR:
# Emerald (#10b981), Cyan (#06b6d4), Amber (#f59e0b), Purple (#a855f7)
PALETTE_BGR = [
    (129, 185, 16),   # Emerald #10b981
    (212, 182, 6),    # Cyan #06b6d4
    (11, 158, 245),   # Amber #f59e0b
    (247, 85, 168),   # Purple #a855f7
]

class VisualAnnotator:
    def __init__(self):
        pass

    def annotate(
        self,
        image: np.ndarray,
        objects: List[Dict[str, Any]],
        calib_result: Optional[Dict[str, Any]],
        show_bbox: bool = True,
        show_polygon: bool = True,
        show_labels: bool = True,
        show_calib: bool = True
    ) -> np.ndarray:
        annotated = image.copy()
        h, w = annotated.shape[:2]

        # 1. Draw Calibration Marker Reference in distinct Amber
        if show_calib and calib_result:
            calib_type = calib_result.get("type")
            unit = calib_result.get("unit", "cm")
            real_dim = calib_result.get("real_dimension", 0.0)
            amber_bgr = (11, 158, 245)

            if calib_type == "coin" and "center" in calib_result:
                cx, cy = [int(v) for v in calib_result["center"]]
                r = int(calib_result.get("radius_px", 30))
                # Outer glowing ring in Amber
                cv2.circle(annotated, (cx, cy), r + 4, amber_bgr, 2, cv2.LINE_AA)
                cv2.circle(annotated, (cx, cy), r + 8, (5, 90, 150), 1, cv2.LINE_AA)
                
                # Badge
                label = f"CALIB: {real_dim:.1f}{unit}"
                (lw, lh), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.42, 1)
                bx = max(8, cx - lw // 2 - 6)
                by = max(lh + 8, cy - r - 12)
                cv2.rectangle(annotated, (bx, by - lh - 4), (bx + lw + 12, by + 4), (20, 20, 20), -1)
                cv2.rectangle(annotated, (bx, by - lh - 4), (bx + lw + 12, by + 4), amber_bgr, 1)
                cv2.putText(annotated, label, (bx + 6, by - 1), cv2.FONT_HERSHEY_SIMPLEX, 0.42, amber_bgr, 1, cv2.LINE_AA)
                
            elif calib_type == "credit_card" and "corners" in calib_result:
                pts = np.array(calib_result["corners"], np.int32)
                cv2.polylines(annotated, [pts], True, amber_bgr, 2, cv2.LINE_AA)
                c = [int(v) for v in calib_result["center"]]
                label = f"CALIB CARD: {real_dim:.1f}{unit}"
                (lw, lh), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.42, 1)
                cv2.rectangle(annotated, (c[0] - lw//2 - 6, c[1] - lh - 4), (c[0] + lw//2 + 6, c[1] + 4), (20, 20, 20), -1)
                cv2.rectangle(annotated, (c[0] - lw//2 - 6, c[1] - lh - 4), (c[0] + lw//2 + 6, c[1] + 4), amber_bgr, 1)
                cv2.putText(annotated, label, (c[0] - lw//2, c[1] - 1), cv2.FONT_HERSHEY_SIMPLEX, 0.42, amber_bgr, 1, cv2.LINE_AA)
                
            elif calib_type == "aruco" and "corners" in calib_result:
                pts = np.array(calib_result["corners"], np.int32)
                cv2.polylines(annotated, [pts], True, amber_bgr, 2, cv2.LINE_AA)
                c = [int(v) for v in calib_result["center"]]
                label = f"CALIB ARUCO: {real_dim:.1f}{unit}"
                (lw, lh), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.42, 1)
                cv2.rectangle(annotated, (c[0] - lw//2 - 6, c[1] - lh - 4), (c[0] + lw//2 + 6, c[1] + 4), (20, 20, 20), -1)
                cv2.rectangle(annotated, (c[0] - lw//2 - 6, c[1] - lh - 4), (c[0] + lw//2 + 6, c[1] + 4), amber_bgr, 1)
                cv2.putText(annotated, label, (c[0] - lw//2, c[1] - 1), cv2.FONT_HERSHEY_SIMPLEX, 0.42, amber_bgr, 1, cv2.LINE_AA)

        # 2. Draw Target Objects
        # In single object mode, only draw the primary object with clean #c4c4c4 neutral highlight
        for idx, obj in enumerate(objects):
            # Neutral #c4c4c4 (BGR: 196, 196, 196) for primary object
            color = (196, 196, 196) if (obj.get("is_primary") or len(objects) == 1) else PALETTE_BGR[idx % len(PALETTE_BGR)]
            m = obj.get("measurements", {})
            unit = m.get("unit", "cm")

            # Draw polygon mask contour
            if show_polygon and "polygon" in obj:
                poly_pts = np.array(obj["polygon"], np.int32)
                cv2.polylines(annotated, [poly_pts], True, color, 2, cv2.LINE_AA)
                # Subtle filled overlay
                overlay = annotated.copy()
                cv2.fillPoly(overlay, [poly_pts], color)
                cv2.addWeighted(overlay, 0.20, annotated, 0.80, 0, annotated)

            # Draw oriented bounding box (thin, subdued — the smooth polygon is the main outline)
            if show_bbox and "min_area_rect" in obj:
                box_corners = np.array(obj["min_area_rect"]["corners"], np.int32)
                cv2.polylines(annotated, [box_corners], True, (235, 235, 235), 1, cv2.LINE_AA)

            # Centroid
            cx, cy = [int(v) for v in obj["centroid"]]
            cv2.circle(annotated, (cx, cy), 4, color, -1, cv2.LINE_AA)
            cv2.circle(annotated, (cx, cy), 6, (255, 255, 255), 1, cv2.LINE_AA)

            # Single clean concise label: #1 | P: ... L: ...
            if show_labels:
                lbl_text = f"#{obj['id']} | P: {m.get('length', 0):.1f}{unit} - L: {m.get('width', 0):.1f}{unit}"
                (lw, lh), _ = cv2.getTextSize(lbl_text, cv2.FONT_HERSHEY_SIMPLEX, 0.42, 1)
                
                badge_x1 = max(6, cx - lw // 2 - 8)
                badge_y1 = max(lh + 10, cy - 24)
                badge_x2 = min(w - 6, badge_x1 + lw + 16)
                badge_y2 = badge_y1 + 6

                # Dark solid rounded badge with accent border
                cv2.rectangle(annotated, (badge_x1, badge_y1 - lh - 6), (badge_x2, badge_y2), (18, 18, 18), -1)
                cv2.rectangle(annotated, (badge_x1, badge_y1 - lh - 6), (badge_x2, badge_y2), color, 1)
                cv2.putText(annotated, lbl_text, (badge_x1 + 8, badge_y1 - 1), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (250, 250, 250), 1, cv2.LINE_AA)

        return annotated

    def to_base64(self, img: np.ndarray) -> str:
        _, buffer = cv2.imencode('.jpg', img, [int(cv2.IMWRITE_JPEG_QUALITY), 94])
        return f"data:image/jpeg;base64,{base64.b64encode(buffer).decode('utf-8')}"
