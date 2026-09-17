"""
Stage 4: Measurement Engine.
Translates pixel-space geometries into physical dimensional metrics (Length, Width, Area, Volume, Density).
"""
import numpy as np
from typing import List, Dict, Any

class MeasurementEngine:
    def __init__(self):
        pass

    def compute_dimensions(
        self, 
        objects: List[Dict[str, Any]], 
        scale: float, 
        unit: str, 
        volume_model: str = "ellipsoid",
        image_shape: tuple = (720, 1280)
    ) -> Dict[str, Any]:
        """
        Computes physical metrics for each object and spatial aggregations across all objects.
        """
        measured_objects = []
        lengths = []
        widths = []
        areas = []
        volumes = []

        scale_sq = scale * scale
        h_px, w_px = image_shape[:2]
        total_frame_area_real = (w_px * h_px) * scale_sq

        for obj in objects:
            px = obj["pixel_metrics"]
            l_px = px["length_px"]
            w_px_val = px["width_px"]
            a_px = px["area_px"]
            # When a YOLO instance-segmentation mask is present, its pixel count is a
            # more exact area estimate than the polygon contour area (which can chop
            # off concave edges). Prefer it for physical area computation.
            mask_area = px.get("mask_area_px")
            area_source_px = mask_area if mask_area is not None else a_px
            p_px = px["perimeter_px"]
            circ = px["circularity"]

            # Real linear dimensions
            real_length = round(l_px * scale, 2)
            real_width = round(w_px_val * scale, 2)
            real_perimeter = round(p_px * scale, 2)
            real_area = round(area_source_px * scale_sq, 2)
            real_box_area = round(real_length * real_width, 2)

            # Volume estimation based on chosen geometry model
            if volume_model == "ellipsoid":
                # Semi-axes: a = L/2, b = W/2, c = W/2
                a_semi = real_length / 2.0
                b_semi = real_width / 2.0
                real_volume = round((4.0 / 3.0) * np.pi * a_semi * (b_semi ** 2), 2)
            elif volume_model == "cylinder":
                # r = W/2, h = L
                radius = real_width / 2.0
                real_volume = round(np.pi * (radius ** 2) * real_length, 2)
            elif volume_model == "box":
                # Assume height is roughly proportional to width
                height = real_width
                real_volume = round(real_length * real_width * height, 2)
            else:
                real_volume = round(real_length * real_width * (real_width * 0.75), 2)

            lengths.append(real_length)
            widths.append(real_width)
            areas.append(real_area)
            volumes.append(real_volume)

            measured_obj = obj.copy()
            measured_obj["measurements"] = {
                "length": real_length,
                "width": real_width,
                "perimeter": real_perimeter,
                "area": real_area,
                "box_area": real_box_area,
                "volume": real_volume,
                "volume_model": volume_model,
                "unit": unit,
                "unit_area": f"{unit}²",
                "unit_volume": f"{unit}³"
            }
            measured_objects.append(measured_obj)

        # Nearest neighbor distances
        centroids = [obj["centroid"] for obj in measured_objects]
        for i, obj in enumerate(measured_objects):
            min_dist = float('inf')
            nn_id = None
            for j, other in enumerate(measured_objects):
                if i != j:
                    dx = centroids[i][0] - centroids[j][0]
                    dy = centroids[i][1] - centroids[j][1]
                    d_px = np.sqrt(dx*dx + dy*dy)
                    if d_px < min_dist:
                        min_dist = d_px
                        nn_id = other["id"]
            obj["measurements"]["nearest_neighbor_id"] = nn_id
            obj["measurements"]["nearest_neighbor_dist"] = round(min_dist * scale, 2) if nn_id else 0.0

        # Aggregation & Statistics
        total_count = len(measured_objects)
        density = round(total_count / total_frame_area_real, 6) if total_frame_area_real > 0 else 0.0

        stats = {
            "total_count": total_count,
            "total_area_frame": round(total_frame_area_real, 2),
            "density": density,
            "density_unit": f"obj/{unit}²",
            "mean_length": round(float(np.mean(lengths)), 2) if lengths else 0.0,
            "mean_width": round(float(np.mean(widths)), 2) if widths else 0.0,
            "mean_area": round(float(np.mean(areas)), 2) if areas else 0.0,
            "mean_volume": round(float(np.mean(volumes)), 2) if volumes else 0.0,
            "std_length": round(float(np.std(lengths)), 2) if lengths else 0.0,
            "min_length": round(float(np.min(lengths)), 2) if lengths else 0.0,
            "max_length": round(float(np.max(lengths)), 2) if lengths else 0.0,
            "distribution": {
                "small": len([l for l in lengths if l < (np.mean(lengths) - 0.5 * np.std(lengths))]) if lengths else 0,
                "medium": len([l for l in lengths if abs(l - np.mean(lengths)) <= 0.5 * np.std(lengths)]) if lengths else 0,
                "large": len([l for l in lengths if l > (np.mean(lengths) + 0.5 * np.std(lengths))]) if lengths else 0,
            }
        }

        return {
            "objects": measured_objects,
            "stats": stats
        }
