"""
Stage 5: Formula Renderer Engine.
Translates each computational step into transparent mathematical representations (LaTeX / KaTeX).
Provides both theoretical definitions and step-by-step arithmetic substitution with real numbers.
"""
from typing import Dict, Any, List, Optional
import numpy as np

class FormulaEngine:
    def __init__(self):
        pass

    def generate_calibration_formula(self, calib: Dict[str, Any]) -> Dict[str, Any]:
        """Generates LaTeX for the pixel-to-metric calibration step."""
        ref_type = calib.get("type", "coin")
        real_dim = calib.get("real_dimension", 2.7)
        px_dim = calib.get("pixel_dimension", 100.0)
        unit = calib.get("unit", "cm")
        scale = calib.get("scale", 0.027)

        algebraic = r"S = \frac{D_{\text{real}}}{d_{\text{px}}}"
        substituted = rf"S = \frac{{{real_dim:.2f}\,\text{{{unit}}}}}{{{px_dim:.1f}\,\text{{px}}}} = {scale:.5f}\,\frac{{\text{{{unit}}}}}{{\text{{px}}}}"

        return {
            "title": "Kalibrasi Skala Piksel ke Fisik",
            "algebraic": algebraic,
            "substituted": substituted,
            "explanation": f"Mengonversi jarak piksel ke satuan {unit} menggunakan referensi {ref_type.upper()}.",
            "variables": {
                "D_{real}": f"{real_dim:.2f} {unit} (dimensi referensi nyata)",
                "d_{px}": f"{px_dim:.1f} px (dimensi referensi terdeteksi)",
                "S": f"{scale:.5f} {unit}/px (faktor skala)"
            }
        }

    def generate_object_formulas(self, obj: Dict[str, Any], scale: float, unit: str) -> List[Dict[str, Any]]:
        """
        Generates step-by-step KaTeX formulas for an individual object.
        """
        px = obj["pixel_metrics"]
        m = obj["measurements"]
        vol_model = m.get("volume_model", "ellipsoid")

        formulas = []

        # 1. Length & Width
        formulas.append({
            "step": 1,
            "metric": "Panjang & Lebar (Oriented Bounding Box)",
            "algebraic": r"L = l_{\text{px}} \cdot S, \quad W = w_{\text{px}} \cdot S",
            "substituted": (
                rf"L = {px['length_px']:.1f}\,\text{{px}} \times {scale:.5f} = \mathbf{{{m['length']:.2f}\,\text{{{unit}}}}}, \quad "
                rf"W = {px['width_px']:.1f}\,\text{{px}} \times {scale:.5f} = \mathbf{{{m['width']:.2f}\,\text{{{unit}}}}}"
            ),
            "explanation": "Dimensi linear dihitung dari oriented minimum area bounding box dikalikan rasio skala."
        })

        # 2. Area
        formulas.append({
            "step": 2,
            "metric": "Luas Kontur Riil (True Contour Area)",
            "algebraic": r"A = a_{\text{px}} \cdot S^2",
            "substituted": (
                rf"A = {px['area_px']:.1f}\,\text{{px}}^2 \times ({scale:.5f})^2 = "
                rf"{px['area_px']:.1f} \times {scale**2:.8f} = \mathbf{{{m['area']:.2f}\,\text{{{unit}}}^2}}"
            ),
            "explanation": "Luas permukaan poligon kontur dikalikan kuadrat rasio skala piksel."
        })

        # 3. Perimeter & Circularity
        circ = px["circularity"]
        formulas.append({
            "step": 3,
            "metric": "Keliling & Derajat Kebulatan (Circularity)",
            "algebraic": r"P = p_{\text{px}} \cdot S, \quad C = \frac{4\pi \cdot a_{\text{px}}}{p_{\text{px}}^2}",
            "substituted": (
                rf"P = {px['perimeter_px']:.1f}\,\text{{px}} \times {scale:.5f} = \mathbf{{{m['perimeter']:.2f}\,\text{{{unit}}}}}, \quad "
                rf"C = \frac{{4\pi \times {px['area_px']:.1f}}}{{({px['perimeter_px']:.1f})^2}} = \mathbf{{{circ:.3f}}}"
            ),
            "explanation": "Nilai C mendekati 1.0 menunjukkan bentuk bulat sempurna (seperti buah atau sel darah)."
        })

        # 4. Volume Estimation
        if vol_model == "ellipsoid":
            a_semi = m["length"] / 2.0
            b_semi = m["width"] / 2.0
            formulas.append({
                "step": 4,
                "metric": "Estimasi Volume 3D (Model Elipsoid / Spheroid)",
                "algebraic": r"V_{\text{ellipsoid}} = \frac{4}{3}\pi \cdot a \cdot b^2 = \frac{4}{3}\pi \left(\frac{L}{2}\right) \left(\frac{W}{2}\right)^2",
                "substituted": (
                    rf"V = \frac{{4}}{{3}}\pi \times \left(\frac{{{m['length']:.2f}}}{{2}}\right) \times \left(\frac{{{m['width']:.2f}}}{{2}}\right)^2 = "
                    rf"\frac{{4}}{{3}}\pi \times {a_semi:.2f} \times ({b_semi:.2f})^2 = \mathbf{{{m['volume']:.2f}\,\text{{{unit}}}^3}}"
                ),
                "explanation": "Objek dimodelkan sebagai elipsoid simetris dengan sumbu mayor L/2 dan sumbu minor W/2."
            })
        elif vol_model == "cylinder":
            radius = m["width"] / 2.0
            formulas.append({
                "step": 4,
                "metric": "Estimasi Volume 3D (Model Silinder)",
                "algebraic": r"V_{\text{cylinder}} = \pi \cdot r^2 \cdot h = \pi \left(\frac{W}{2}\right)^2 \cdot L",
                "substituted": (
                    rf"V = \pi \times \left(\frac{{{m['width']:.2f}}}{{2}}\right)^2 \times {m['length']:.2f} = "
                    rf"\pi \times ({radius:.2f})^2 \times {m['length']:.2f} = \mathbf{{{m['volume']:.2f}\,\text{{{unit}}}^3}}"
                ),
                "explanation": "Cocok untuk objek berbentuk silindris seperti botol, kapsul, atau pipa."
            })
        elif vol_model == "box":
            formulas.append({
                "step": 4,
                "metric": "Estimasi Volume 3D (Model Balok / Cuboid)",
                "algebraic": r"V_{\text{box}} = L \cdot W \cdot H",
                "substituted": (
                    rf"V = {m['length']:.2f} \times {m['width']:.2f} \times {m['width']:.2f} = \mathbf{{{m['volume']:.2f}\,\text{{{unit}}}^3}}"
                ),
                "explanation": "Dimensi balok persegi dengan estimasi tinggi proporsional terhadap lebar."
            })

        return formulas

    def generate_density_formula(self, total_count: int, total_area: float, density: float, unit: str) -> Dict[str, Any]:
        """Generates LaTeX for spatial density."""
        return {
            "metric": "Densitas Kepadatan Spasial",
            "algebraic": r"\rho = \frac{N_{\text{total}}}{A_{\text{frame}}}",
            "substituted": rf"\rho = \frac{{{total_count}}}{{{total_area:.1f}\,\text{{{unit}}}^2}} = \mathbf{{{density:.6f}\,\frac{{\text{{obj}}}}{{\text{{{unit}}}^2}}}}",
            "explanation": "Jumlah objek terdeteksi dibagi total area visual bidang pengamatan."
        }

    def generate_summary_formulas(self, stats: Dict[str, Any], unit: str) -> Dict[str, Any]:
        """Generates statistical formulas (Mean, Standard Deviation, Density)."""
        n = stats.get("total_count", 0)
        mean_l = stats.get("mean_length", 0.0)
        std_l = stats.get("std_length", 0.0)
        mean_a = stats.get("mean_area", 0.0)
        total_area = stats.get("total_area_frame", 1.0)
        density = stats.get("density", 0.0)

        return {
            "mean_length": {
                "algebraic": r"\bar{L} = \frac{1}{N}\sum_{i=1}^{N} L_i",
                "substituted": rf"\bar{{L}} = \frac{{1}}{{{n}}}\sum L_i = \mathbf{{{mean_l:.2f}\,\text{{{unit}}}}}"
            },
            "std_length": {
                "algebraic": r"\sigma_L = \sqrt{\frac{1}{N}\sum_{i=1}^{N}(L_i - \bar{L})^2}",
                "substituted": rf"\sigma_L = \mathbf{{{std_l:.2f}\,\text{{{unit}}}}}"
            },
            "density": self.generate_density_formula(n, total_area, density, unit)
        }
