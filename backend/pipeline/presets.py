"""
Stage 1: Realistic Preset Scene Generator.
Provides ready-to-test synthetic computer vision scenes with ground-truth reference objects:
1. Fruit Grading (Apples & Oranges with 500 IDR reference coin)
2. Warehouse Boxes (Packages with Credit Card reference)
3. Microscope Blood Cells (Cell culture with micrometer scale reference)
4. Industrial Parts (Bolts & Washers with ArUco Marker)
"""
import cv2
import numpy as np
import base64
from typing import Dict, Any, List

def draw_aruco_marker(img: np.ndarray, x: int, y: int, size: int, marker_id: int = 0):
    """Draws a synthetic ArUco 4x4 marker."""
    try:
        if hasattr(cv2, 'aruco') and hasattr(cv2.aruco, 'getPredefinedDictionary'):
            dictionary = cv2.aruco.getPredefinedDictionary(cv2.aruco.DICT_4X4_50)
            marker_img = cv2.aruco.generateImageMarker(dictionary, marker_id, size)
            marker_bgr = cv2.cvtColor(marker_img, cv2.COLOR_GRAY2BGR)
            img[y:y+size, x:x+size] = marker_bgr
            return
    except Exception:
        pass
    # Fallback synthetic grid
    cv2.rectangle(img, (x, y), (x+size, y+size), (0, 0, 0), -1)
    cv2.rectangle(img, (x+size//5, y+size//5), (x+size*4//5, y+size*4//5), (255, 255, 255), -1)
    cv2.rectangle(img, (x+size*2//5, y+size*2//5), (x+size*3//5, y+size*3//5), (0, 0, 0), -1)

def draw_coin(img: np.ndarray, x: int, y: int, radius: int, text: str = "500 IDR"):
    """Draws a metallic coin reference."""
    # Outer ring
    cv2.circle(img, (x, y), radius, (140, 150, 160), -1, cv2.LINE_AA)
    # Bevel highlight
    cv2.circle(img, (x, y), radius - 3, (190, 200, 210), 2, cv2.LINE_AA)
    # Inner face
    cv2.circle(img, (x, y), radius - 6, (170, 180, 190), -1, cv2.LINE_AA)
    cv2.putText(img, text, (x - radius + 8, y + 4), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (70, 80, 90), 1, cv2.LINE_AA)

def draw_credit_card(img: np.ndarray, x: int, y: int, w: int, h: int):
    """Draws a standard credit card reference."""
    # Shadow
    cv2.rectangle(img, (x+4, y+4), (x+w+4, y+h+4), (40, 40, 40), -1)
    # Card body
    cv2.rectangle(img, (x, y), (x+w, y+h), (70, 130, 180), -1)
    cv2.rectangle(img, (x, y), (x+w, y+h), (200, 220, 240), 2)
    # Chip
    cv2.rectangle(img, (x+15, y+15), (x+35, y+32), (212, 175, 55), -1)
    cv2.putText(img, "REF CARD 85.6mm", (x+15, y+h-15), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1, cv2.LINE_AA)

class PresetGenerator:
    def __init__(self):
        pass

    def get_preset_list(self) -> List[Dict[str, Any]]:
        return [
            {
                "id": "fruit_sorting",
                "name": "Sortir Buah Pertanian (Apel & Jeruk)",
                "description": "Deteksi apel & jeruk pada ban berjalan dengan koin 500 IDR (27 mm) sebagai kalibrasi.",
                "category": "fruit",
                "default_prompt": "Hitung jumlah buah apel dan jeruk, ukur diameter dan estimasi volumenya dalam cm dengan referensi koin 500 IDR.",
                "target_object": "buah",
                "mode": "both",
                "unit": "cm",
                "calibration_type": "coin_idr500",
                "reference_real_size_mm": 27.0,
                "volume_model": "ellipsoid",
                "single_object_mode": False
            },
            {
                "id": "warehouse_boxes",
                "name": "Dimensi Paket Gudang / Logistik",
                "description": "Pengukuran panjang, lebar, dan volume paket kardus menggunakan referensi kartu standar (85.6 mm).",
                "category": "box",
                "default_prompt": "Ukur dimensi panjang, lebar, dan volume paket kardus dalam cm menggunakan kartu referensi.",
                "target_object": "box",
                "mode": "measure",
                "unit": "cm",
                "calibration_type": "credit_card",
                "reference_real_size_mm": 85.60,
                "volume_model": "box",
                "single_object_mode": False
            },
            {
                "id": "microscope_cells",
                "name": "Pencacahan Sel Mikroskopis (Riset Medis)",
                "description": "Menghitung jumlah sel darah / mikroba, densitas spasial per mm², dan sebaran luas.",
                "category": "cell",
                "default_prompt": "Hitung semua sel mikroskopis dan hitung densitas kepadatannya dalam mm.",
                "target_object": "sel",
                "mode": "both",
                "unit": "mm",
                "calibration_type": "coin_idr500",
                "reference_real_size_mm": 1.0,
                "volume_model": "ellipsoid",
                "single_object_mode": False
            },
            {
                "id": "industrial_parts",
                "name": "Inspeksi Komponen Industri (Mur & Baut)",
                "description": "Quality control suku cadang manufaktur dengan marker ArUco 4x4 (50 mm).",
                "category": "part",
                "default_prompt": "Hitung dan ukur dimensi mur dan baut menggunakan ArUco marker dalam mm.",
                "target_object": "part",
                "mode": "both",
                "unit": "mm",
                "calibration_type": "aruco",
                "reference_real_size_mm": 50.0,
                "volume_model": "cylinder",
                "single_object_mode": False
            }
        ]

    def generate_image(self, preset_id: str) -> np.ndarray:
        w, h = 1000, 650
        
        if preset_id == "fruit_sorting":
            # Dark conveyor surface
            img = np.full((h, w, 3), (35, 35, 38), dtype=np.uint8)
            # Add texture noise
            noise = np.random.randint(-5, 5, (h, w, 3), dtype=np.int16)
            img = np.clip(img.astype(np.int16) + noise, 0, 255).astype(np.uint8)
            
            # Draw Reference Coin (27 mm diameter -> say 70 px diameter => ~0.385 mm/px)
            draw_coin(img, 120, 110, 36, "500 IDR")

            # Fruit 1: Big Red Apple
            cv2.ellipse(img, (320, 220), (65, 60), 10, 0, 360, (30, 40, 210), -1, cv2.LINE_AA)
            cv2.circle(img, (315, 205), 18, (70, 80, 240), -1, cv2.LINE_AA) # Specular highlight

            # Fruit 2: Golden Orange
            cv2.circle(img, (530, 180), 55, (20, 140, 240), -1, cv2.LINE_AA)
            cv2.circle(img, (520, 170), 14, (70, 170, 255), -1, cv2.LINE_AA)

            # Fruit 3: Small Apple
            cv2.ellipse(img, (720, 240), (52, 48), -15, 0, 360, (25, 35, 195), -1, cv2.LINE_AA)

            # Fruit 4: Orange
            cv2.circle(img, (380, 430), 58, (15, 135, 235), -1, cv2.LINE_AA)

            # Fruit 5: Medium Apple
            cv2.ellipse(img, (600, 440), (60, 56), 25, 0, 360, (20, 30, 200), -1, cv2.LINE_AA)

            # Fruit 6: Apple
            cv2.ellipse(img, (830, 410), (58, 54), -5, 0, 360, (35, 45, 220), -1, cv2.LINE_AA)

            return img

        elif preset_id == "warehouse_boxes":
            # Neutral table surface
            img = np.full((h, w, 3), (45, 45, 48), dtype=np.uint8)
            
            # Reference Credit Card (85.6 mm width -> 160 px => scale ~ 0.535 mm/px)
            draw_credit_card(img, 60, 60, 160, 100)

            # Box 1: Large Shipping Box
            pts1 = np.array([[280, 120], [480, 100], [530, 320], [330, 340]], np.int32)
            cv2.fillPoly(img, [pts1], (80, 125, 175), cv2.LINE_AA)
            cv2.polylines(img, [pts1], True, (40, 70, 110), 2, cv2.LINE_AA)
            cv2.putText(img, "BOX-01", (350, 230), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (30, 50, 90), 2)

            # Box 2: Medium Box
            pts2 = np.array([[600, 140], [780, 160], [760, 330], [580, 310]], np.int32)
            cv2.fillPoly(img, [pts2], (90, 140, 190), cv2.LINE_AA)
            cv2.polylines(img, [pts2], True, (45, 80, 120), 2, cv2.LINE_AA)
            cv2.putText(img, "BOX-02", (640, 240), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (30, 50, 90), 2)

            # Box 3: Small Box
            pts3 = np.array([[380, 420], [560, 410], [550, 560], [370, 570]], np.int32)
            cv2.fillPoly(img, [pts3], (75, 115, 165), cv2.LINE_AA)
            cv2.polylines(img, [pts3], True, (35, 65, 105), 2, cv2.LINE_AA)
            cv2.putText(img, "BOX-03", (430, 500), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (30, 50, 90), 2)

            # Box 4: Long Carton
            pts4 = np.array([[640, 400], [900, 390], [890, 530], [630, 540]], np.int32)
            cv2.fillPoly(img, [pts4], (85, 130, 180), cv2.LINE_AA)
            cv2.polylines(img, [pts4], True, (40, 75, 115), 2, cv2.LINE_AA)
            cv2.putText(img, "BOX-04", (720, 470), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (30, 50, 90), 2)

            return img

        elif preset_id == "microscope_cells":
            # Microscope field (deep blue-purple vignette)
            img = np.full((h, w, 3), (25, 15, 20), dtype=np.uint8)
            cv2.circle(img, (w//2, h//2), int(min(w, h)*0.48), (55, 30, 45), -1, cv2.LINE_AA)
            cv2.circle(img, (w//2, h//2), int(min(w, h)*0.38), (75, 45, 65), -1, cv2.LINE_AA)

            # Reference circular bead (1.0 mm -> 50 px)
            draw_coin(img, 120, 100, 25, "1.0mm REF")

            # Seed pseudo-random cells
            np.random.seed(42)
            cell_centers = []
            for _ in range(24):
                cx = np.random.randint(220, 820)
                cy = np.random.randint(120, 540)
                # ensure inside microscope circle
                if (cx - w//2)**2 + (cy - h//2)**2 < (min(w,h)*0.36)**2:
                    rx = np.random.randint(16, 26)
                    ry = np.random.randint(15, 24)
                    ang = np.random.randint(0, 180)
                    cv2.ellipse(img, (cx, cy), (rx, ry), ang, 0, 360, (180, 60, 140), -1, cv2.LINE_AA)
                    cv2.circle(img, (cx, cy), int(rx*0.4), (230, 120, 190), -1, cv2.LINE_AA) # Nucleus

            return img

        elif preset_id == "industrial_parts":
            # Metallic grid surface
            img = np.full((h, w, 3), (40, 42, 45), dtype=np.uint8)
            
            # ArUco Marker (50 mm -> 120 px => scale ~ 0.416 mm/px)
            draw_aruco_marker(img, 60, 60, 120, marker_id=0)

            # Screws (cylinders / elongated parts)
            # Part 1: Long screw
            pts1 = np.array([[260, 140], [420, 140], [420, 190], [260, 190]], np.int32)
            cv2.fillPoly(img, [pts1], (180, 185, 190), cv2.LINE_AA)
            cv2.rectangle(img, (240, 130), (265, 200), (140, 145, 150), -1) # screw head

            # Part 2: Hex Bolt
            pts2 = np.array([[520, 160], [660, 160], [660, 205], [520, 205]], np.int32)
            cv2.fillPoly(img, [pts2], (175, 180, 185), cv2.LINE_AA)
            cv2.rectangle(img, (500, 150), (525, 215), (135, 140, 145), -1)

            # Part 3: Washer (Hollow circle)
            cv2.circle(img, (780, 190), 45, (190, 195, 200), -1, cv2.LINE_AA)
            cv2.circle(img, (780, 190), 20, (40, 42, 45), -1, cv2.LINE_AA)

            # Part 4: Second Washer
            cv2.circle(img, (330, 360), 40, (185, 190, 195), -1, cv2.LINE_AA)
            cv2.circle(img, (330, 360), 18, (40, 42, 45), -1, cv2.LINE_AA)

            # Part 5: Medium screw
            pts5 = np.array([[460, 340], [600, 380], [585, 430], [445, 390]], np.int32)
            cv2.fillPoly(img, [pts5], (170, 175, 180), cv2.LINE_AA)

            # Part 6: Washer
            cv2.circle(img, (720, 390), 38, (195, 200, 205), -1, cv2.LINE_AA)
            cv2.circle(img, (720, 390), 16, (40, 42, 45), -1, cv2.LINE_AA)

            return img

        # Default fallback
        return np.full((h, w, 3), (35, 35, 38), dtype=np.uint8)

    def get_preset_base64(self, preset_id: str) -> str:
        img = self.generate_image(preset_id)
        _, buffer = cv2.imencode('.png', img)
        return f"data:image/png;base64,{base64.b64encode(buffer).decode('utf-8')}"
