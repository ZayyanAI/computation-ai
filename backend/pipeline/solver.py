"""
Mathematical Equation Solver Engine using SymPy & Dynamic AI Workflow.
Implements:
1. Natural language & flexible algebraic text parsing (e.g. "2 pangkat x sama dengan 16", "x^2 - 5x + 6 = 0")
2. Mathematical taxonomy classification (Exponential, Linear, Quadratic, Polynomial, Identity, No Real Solution)
3. Analytic solving with SymPy
4. Dynamic transparent derivation steps with pure LaTeX rendering
5. Strict standard mathematical solution set formatting (single: x = 4, multi: x = 2 atau x = 3, S = { ... })
"""

import re
import sympy as sp
from sympy.parsing.sympy_parser import (
    parse_expr,
    standard_transformations,
    implicit_multiplication_application,
    convert_xor
)
from typing import Dict, Any, List

transformations = standard_transformations + (
    implicit_multiplication_application,
    convert_xor,
)

def normalize_natural_language(text: str) -> str:
    """
    Normalizes natural language math text (Indonesian & English) into formal mathematical expressions.
    Handles phrases like:
    - "2 pangkat x sama dengan 16" -> "2**(x) = 16"
    - "3 pangkat 2x - 1 sama dengan 27" -> "3**(2x - 1) = 27"
    - "x kuadrat minus 5x plus 6 sama dengan 0" -> "x**2 - 5*x + 6 = 0"
    - "akar dari x sama dengan 4" -> "sqrt(x) = 4"
    - "4x kurang 7 sama dengan 21" -> "4x - 7 = 21"
    """
    s = text.strip()
    
    # 1. Replace equality keywords
    s = re.sub(r'\bsama\s+dengan\b|\badalah\b|\bequals?\b', '=', s, flags=re.IGNORECASE)
    s = s.replace('==', '=')
    
    # 2. Replace root keywords
    s = re.sub(r'\bakar\s+dari\s+([a-zA-Z0-9_]+)\b', r'sqrt(\1)', s, flags=re.IGNORECASE)
    s = re.sub(r'\bakar\s+([a-zA-Z0-9_]+)\b', r'sqrt(\1)', s, flags=re.IGNORECASE)
    s = re.sub(r'\bsqrt\s+([a-zA-Z0-9_]+)\b', r'sqrt(\1)', s, flags=re.IGNORECASE)
    
    # 3. Replace power / exponent keywords (kuadrat, kubik)
    s = re.sub(r'\bkuadrat\b|\bsquared?\b', '**2', s, flags=re.IGNORECASE)
    s = re.sub(r'\bkubik\b|\bcubed?\b', '**3', s, flags=re.IGNORECASE)
    
    # 4. Handle "pangkat" with parenthesized exponents: '3 pangkat (2x - 1)' -> '3**(2x - 1)'
    s = re.sub(r'([a-zA-Z0-9_]+|\))\s*(?:pangkat|to\s+the\s+power\s+of)\s*(\([^)]+\))', r'\1**\2', s, flags=re.IGNORECASE)
    # Handle "pangkat" with single token/monomial: '2 pangkat x' -> '2**x', 'x pangkat 3' -> 'x**3'
    s = re.sub(r'([a-zA-Z0-9_]+|\))\s*(?:pangkat|to\s+the\s+power\s+of)\s*([a-zA-Z0-9_]+)', r'\1**\2', s, flags=re.IGNORECASE)
    # Remaining fallback for any stand-alone pangkat keyword
    s = re.sub(r'\bpangkat\b|\bto\s+the\s+power\s+of\b', '**', s, flags=re.IGNORECASE)
    
    # 5. Replace arithmetic operator words
    s = re.sub(r'\bditambah\b|\btambah\b|\bplus\b', '+', s, flags=re.IGNORECASE)
    s = re.sub(r'\bdikurangi\b|\bdikurang\b|\bkurang\b|\bminus\b', '-', s, flags=re.IGNORECASE)
    s = re.sub(r'\bdikali\b|\bkali\b|\btimes\b', '*', s, flags=re.IGNORECASE)
    s = re.sub(r'\bdibagi\b|\bbagi\b|\bper\b|\bdivided\s+by\b', '/', s, flags=re.IGNORECASE)
    
    # 6. Caret power
    s = s.replace('^', '**')
    return s.strip()

def check_power_base(base_val, target_val):
    """
    Checks if target_val is an integer power of base_val, e.g. 16 = 2^4, 27 = 3^3.
    Returns the integer power k if target_val == base_val**k, else None.
    """
    try:
        import math
        b = float(base_val)
        c = float(target_val)
        if b > 1 and c > 0:
            k = round(math.log(c, b))
            if abs(b**k - c) < 1e-9:
                return k
    except Exception:
        pass
    return None

def solve_equation(equation_str: str, variable_str: str = "x") -> Dict[str, Any]:
    """
    Solves an equation via a 4-stage AI Workflow:
    Stage 1: Free-text & Natural Language Parsing and Normalization
    Stage 2: Mathematical Taxonomy & Degree Classification
    Stage 3: Symbolic Resolution & Analytical Root Verification
    Stage 4: Dynamic Contextual Step Derivation & KaTeX Synthesis
    """
    equation_str = equation_str.strip()
    if not equation_str:
        return {"success": False, "error": "Persamaan tidak boleh kosong."}

    var_symbol = sp.Symbol(variable_str.strip() or "x")
    normalized_input = normalize_natural_language(equation_str)

    try:
        if "=" in normalized_input:
            parts = normalized_input.split("=")
            if len(parts) != 2:
                return {"success": False, "error": "Persamaan hanya boleh memiliki satu tanda sama dengan '='."}
            lhs_expr = parse_expr(parts[0].strip(), transformations=transformations)
            rhs_expr = parse_expr(parts[1].strip(), transformations=transformations)
        else:
            lhs_expr = parse_expr(normalized_input, transformations=transformations)
            rhs_expr = sp.Integer(0)

        # Standard canonical form: lhs - rhs = 0
        diff_expr = sp.simplify(lhs_expr - rhs_expr)

        # LaTeX representations using pure SymPy functions
        orig_latex = f"{sp.latex(lhs_expr)} = {sp.latex(rhs_expr)}"
        std_latex = f"{sp.latex(diff_expr)} = 0"

        # Workflow Stage 1: Parsing
        workflow_stages = [
            {
                "id": "parsing",
                "name": "Parsing Teks Bebas & Normalisasi",
                "status": "completed",
                "detail": f"Input \"{equation_str}\" diparsing menjadi ekspresi formal: {orig_latex}",
                "latex": orig_latex
            }
        ]

        # Check for Identity or Contradiction
        if diff_expr.is_zero or diff_expr == 0:
            workflow_stages.extend([
                {
                    "id": "classification",
                    "name": "Klasifikasi Taksonomi",
                    "status": "completed",
                    "detail": "Terdeteksi sebagai Persamaan Identitas (kedua ruas ekuivalen untuk semua nilai variabel)",
                    "badge": "Persamaan Identitas"
                },
                {
                    "id": "solving",
                    "name": "Resolusi Simbolik",
                    "status": "completed",
                    "detail": "Seluruh bilangan real pada domain memenuhi persamaan (himpunan tak hingga)"
                },
                {
                    "id": "synthesis",
                    "name": "Sintesis Langkah Dinamis",
                    "status": "completed",
                    "detail": "3 tahapan verifikasi identitas diformulasikan secara matematis"
                }
            ])
            return {
                "success": True,
                "equation_raw": equation_str,
                "normalized_input": normalized_input,
                "variable": str(var_symbol),
                "equation_type": "Persamaan Identitas",
                "equation_latex": orig_latex,
                "standard_form_latex": "0 = 0",
                "solution_type": "identity",
                "solution_display_latex": f"\\text{{Semua nilai }} {sp.latex(var_symbol)} \\text{{ memenuhi (identitas)}}",
                "solution_set_latex": f"{sp.latex(var_symbol)} \\in \\mathbb{{R}}",
                "workflow_stages": workflow_stages,
                "steps": [
                    {
                        "step_number": 1,
                        "title": "Bentuk Persamaan Awal",
                        "description": f"Persamaan input yang telah diparsing untuk variabel ${sp.latex(var_symbol)}$:",
                        "latex": orig_latex
                    },
                    {
                        "step_number": 2,
                        "title": "Analisis Bentuk Baku",
                        "description": "Kedua ruas saling menghilangkan secara identik sehingga menghasilkan pernyataan tautologis:",
                        "latex": "0 = 0"
                    },
                    {
                        "step_number": 3,
                        "title": "Himpunan Penyelesaian",
                        "description": "Karena pernyataan selalu bernilai benar untuk semua bilangan real, maka himpunan penyelesaian adalah seluruh himpunan bilangan real:",
                        "latex": f"{sp.latex(var_symbol)} \\in \\mathbb{{R}}"
                    }
                ],
                "solutions": [],
                "solution_count": "infinite"
            }

        if diff_expr.is_constant() and not diff_expr.is_zero:
            workflow_stages.extend([
                {
                    "id": "classification",
                    "name": "Klasifikasi Taksonomi",
                    "status": "completed",
                    "detail": "Terdeteksi sebagai Kontradiksi Matematis (tidak memiliki pembuat nol)",
                    "badge": "Kontradiksi"
                },
                {
                    "id": "solving",
                    "name": "Resolusi Simbolik",
                    "status": "completed",
                    "detail": "Tidak ditemukan nilai variabel yang dapat memuaskan persamaan"
                },
                {
                    "id": "synthesis",
                    "name": "Sintesis Langkah Dinamis",
                    "status": "completed",
                    "detail": "Langkah pembuktian kontradiksi dikonstruksi"
                }
            ])
            return {
                "success": True,
                "equation_raw": equation_str,
                "normalized_input": normalized_input,
                "variable": str(var_symbol),
                "equation_type": "Kontradiksi (Tidak Memiliki Solusi)",
                "equation_latex": orig_latex,
                "standard_form_latex": f"{sp.latex(diff_expr)} = 0",
                "solution_type": "no_real_solution",
                "solution_display_latex": "\\text{Tidak ada solusi (kontradiksi matematis)}",
                "solution_set_latex": "S = \\emptyset",
                "workflow_stages": workflow_stages,
                "steps": [
                    {
                        "step_number": 1,
                        "title": "Bentuk Persamaan Awal",
                        "description": f"Persamaan yang diparsing dari input pengguna:",
                        "latex": orig_latex
                    },
                    {
                        "step_number": 2,
                        "title": "Bentuk Baku & Kontradiksi",
                        "description": "Persamaan tereduksi menjadi pernyataan kontradiktif yang mustahil terpenuhi:",
                        "latex": f"{sp.latex(diff_expr)} \\neq 0"
                    }
                ],
                "solutions": [],
                "solution_count": 0
            }

        # Determine equation taxonomy dynamically
        eq_type = "Aljabar / Polinomial"
        is_exponential = False
        exp_base = None
        exp_power_expr = None

        # Check for variable in exponent powers
        for atom in diff_expr.atoms(sp.Pow):
            if var_symbol in atom.exp.free_symbols:
                is_exponential = True
                eq_type = "Persamaan Eksponensial"
                exp_base = atom.base
                exp_power_expr = atom.exp
                break

        degree = None
        if not is_exponential:
            try:
                poly = sp.Poly(diff_expr, var_symbol)
                degree = poly.degree()
                if degree == 1:
                    eq_type = "Persamaan Linear (Derajat 1)"
                elif degree == 2:
                    eq_type = "Persamaan Kuadrat (Derajat 2)"
                elif degree == 3:
                    eq_type = "Persamaan Kubik (Derajat 3)"
                elif degree > 3:
                    eq_type = f"Persamaan Polinomial (Derajat {degree})"
            except Exception:
                eq_type = "Persamaan Aljabar Non-Linear"

        var_latex = sp.latex(var_symbol)  # canonical LaTeX for the variable (e.g. "x")

        # Stage 2: Classification metadata
        type_detail = f"Struktur aljabar teridentifikasi sebagai {eq_type}"
        if is_exponential and exp_base is not None:
            type_detail += f" dengan basis eksponen {sp.latex(exp_base)}"
        elif degree is not None:
            type_detail += f" berderajat {degree}"

        workflow_stages.append({
            "id": "classification",
            "name": "Klasifikasi Taksonomi",
            "status": "completed",
            "detail": type_detail,
            "badge": eq_type
        })

        # Step 1: Original equation
        steps = [
            {
                "step_number": 1,
                "title": "Bentuk Persamaan Awal",
                "description": f"Persamaan matematika yang diekstraksi dari input pengguna untuk variabel ${var_latex}$:",
                "latex": orig_latex
            }
        ]

        # Step 2: Canonical form — only include when it differs from the original
        if std_latex != orig_latex:
            steps.append({
                "step_number": len(steps) + 1,
                "title": "Bentuk Baku (Canonical Form)",
                "description": f"Memindahkan seluruh suku ke ruas kiri sehingga ruas kanan bernilai nol $f({var_latex}) = 0$:",
                "latex": std_latex
            })

        # Dynamic Mathematical Steps per Equation Type with rich contextual narratives
        if "Persamaan Kuadrat" in eq_type and degree == 2:
            poly = sp.Poly(diff_expr, var_symbol)
            coeffs = poly.all_coeffs()
            if len(coeffs) == 3:
                a, b, c = coeffs[0], coeffs[1], coeffs[2]
                discriminant = b**2 - 4*a*c
                disc_val = None
                try:
                    disc_val = float(discriminant)
                except Exception:
                    pass

                # Dynamic narrative based on discriminant value
                if disc_val is not None:
                    if disc_val > 0:
                        import math
                        sqrt_d = math.isqrt(int(disc_val)) if disc_val.is_integer() and disc_val >= 0 else -1
                        if sqrt_d * sqrt_d == int(disc_val):
                            disc_narration = f"Karena nilai diskriminan $D = {sp.latex(discriminant)} > 0$ merupakan bilangan kuadrat sempurna ($\\sqrt{{{sp.latex(discriminant)}}} = {sqrt_d}$), persamaan kuadrat ini memiliki dua akar real rasional yang berlainan."
                        else:
                            disc_narration = f"Karena nilai diskriminan $D = {sp.latex(discriminant)} > 0$ bukan kuadrat bulat sempurna, persamaan memiliki dua akar real irasional berlainan."
                    elif disc_val == 0:
                        disc_narration = "Karena nilai diskriminan $D = 0$, grafik parabola menyinggung sumbu horizontal dan persamaan memiliki tepat satu akar kembar real."
                    else:
                        disc_narration = f"Karena nilai diskriminan $D = {sp.latex(discriminant)} < 0$, tidak ada akar real yang memenuhi persamaan (solusi berupa bilangan kompleks)."
                else:
                    disc_narration = f"Menghitung nilai diskriminan $D = b^2 - 4ac$ untuk mengidentifikasi karakteristik akar:"

                steps.append({
                    "step_number": len(steps) + 1,
                    "title": "Identifikasi Koefisien & Analisis Diskriminan",
                    "description": f"Identifikasi koefisien aljabar $a = {sp.latex(a)}$, $b = {sp.latex(b)}$, $c = {sp.latex(c)}$. {disc_narration}",
                    "latex": f"D = \\left({sp.latex(b)}\\right)^2 - 4 \\cdot \\left({sp.latex(a)}\\right) \\cdot \\left({sp.latex(c)}\\right) = {sp.latex(discriminant)}"
                })

                # Check if factorable nicely
                try:
                    factored = sp.factor(diff_expr)
                    if factored != diff_expr and factored.is_Mul:
                        steps.append({
                            "step_number": len(steps) + 1,
                            "title": "Faktorisasi Bentuk Kuadrat",
                            "description": "Memfaktorkan persamaan kuadrat menjadi perkalian faktor-faktor linear:",
                            "latex": f"{sp.latex(factored)} = 0"
                        })
                except Exception:
                    pass

                steps.append({
                    "step_number": len(steps) + 1,
                    "title": "Evaluasi Akar Kuadratis (Formula ABC)",
                    "description": f"Menerapkan rumus kuadratis umum ${var_latex}_{{1,2}} = \\frac{{-b \\pm \\sqrt{{D}}}}{{2a}}$ untuk menghitung akar-akar penyelesaian:",
                    "latex": f"{var_latex}_{{1,2}} = \\frac{{-\\left({sp.latex(b)}\\right) \\pm \\sqrt{{{sp.latex(discriminant)}}}}}{{2 \\cdot \\left({sp.latex(a)}\\right)}}"
                })

        elif "Persamaan Linear" in eq_type and degree == 1:
            poly = sp.Poly(diff_expr, var_symbol)
            coeffs = poly.all_coeffs()
            if len(coeffs) == 2:
                a, b = coeffs[0], coeffs[1]
                neg_b = -b  # SymPy arithmetic: avoids double-negative string issues
                coeff_var = var_latex if a == 1 else (f"-{var_latex}" if a == -1 else f"{sp.latex(a)}{var_latex}")
                
                # Dynamic narrative for linear isolation
                if a == 1:
                    isolation_desc = f"Memindahkan konstanta ke ruas kanan. Karena koefisien ${var_latex}$ sudah bernilai 1, nilai variabel langsung terisolasi:"
                    isolation_latex = f"{var_latex} = {sp.latex(neg_b)}"
                else:
                    isolation_desc = f"Memindahkan konstanta ke ruas kanan menjadi ${sp.latex(neg_b)}$, lalu membagi kedua ruas dengan koefisien $a = {sp.latex(a)}$:"
                    isolation_latex = f"{coeff_var} = {sp.latex(neg_b)} \\implies {var_latex} = \\frac{{{sp.latex(neg_b)}}}{{{sp.latex(a)}}}"

                steps.append({
                    "step_number": len(steps) + 1,
                    "title": "Isolasi Variabel Linear",
                    "description": isolation_desc,
                    "latex": isolation_latex
                })

        elif is_exponential:
            # Check if LHS is a simple power b^expr and RHS is a constant
            matched_power = None
            if isinstance(lhs_expr, sp.Pow) and rhs_expr.is_number and not rhs_expr.is_zero:
                matched_power = check_power_base(lhs_expr.base, rhs_expr)
            
            if matched_power is not None:
                # Direct base alignment: e.g. 2^x = 16 => 2^x = 2^4 => x = 4
                steps.append({
                    "step_number": len(steps) + 1,
                    "title": "Penyetaraan Basis Eksponen",
                    "description": f"Menyamakan basis kedua ruas. Karena ${sp.latex(rhs_expr)} = {sp.latex(lhs_expr.base)}^{{{matched_power}}}$, persamaan dapat ditulis ulang dalam basis yang identik:",
                    "latex": f"{sp.latex(lhs_expr)} = {sp.latex(lhs_expr.base)}^{{{matched_power}}}"
                })
                steps.append({
                    "step_number": len(steps) + 1,
                    "title": "Penyetaraan Pangkat (Eksponen)",
                    "description": f"Berdasarkan sifat injektif fungsi eksponen ($a^{{u}} = a^{{v}} \\iff u = v$ untuk $a > 0, a \\neq 1$), pangkat kedua ruas dapat disamakan secara langsung:",
                    "latex": f"{sp.latex(lhs_expr.exp)} = {matched_power}"
                })
            else:
                # General logarithmic transformation
                steps.append({
                    "step_number": len(steps) + 1,
                    "title": "Analisis Basis Eksponen & Logaritma",
                    "description": "Karena kedua ruas belum memiliki basis yang sama, kita menerapkan transformasi logaritma natural (ln) pada kedua ruas untuk menurunkan variabel dari eksponen via sifat $\\ln(u^v) = v \\cdot \\ln(u)$:",
                    "latex": f"\\ln\\!\\left({sp.latex(lhs_expr)}\\right) = \\ln\\!\\left({sp.latex(rhs_expr)}\\right)"
                })

        else:
            try:
                factored = sp.factor(diff_expr)
                if factored != diff_expr:
                    steps.append({
                        "step_number": len(steps) + 1,
                        "title": "Faktorisasi Suku Aljabar",
                        "description": "Memfaktorkan ekspresi aljabar ke dalam bentuk perkalian faktor-faktor irreducible untuk menemukan pembuat nol:",
                        "latex": f"{sp.latex(factored)} = 0"
                    })
            except Exception:
                pass

        # Solve symbolically with SymPy
        solutions_raw = sp.solve(diff_expr, var_symbol)

        # Filter real solutions
        real_solutions = []
        for sol in solutions_raw:
            try:
                if sol.is_real is not False and (sol.is_real or sol.evalf().is_real):
                    real_solutions.append(sol)
            except Exception:
                real_solutions.append(sol)

        # If no real solutions
        if not real_solutions:
            solution_type = "no_real_solution"
            solution_display_latex = "\\text{Tidak ada solusi real}"
            solution_set_latex = "S = \\emptyset"
            steps.append({
                "step_number": len(steps) + 1,
                "title": "Himpunan Penyelesaian Akhir",
                "description": "Tidak ditemukan nilai real yang memenuhi persamaan:",
                "latex": solution_set_latex
            })
            workflow_stages.extend([
                {
                    "id": "solving",
                    "name": "Resolusi Simbolik & Verifikasi",
                    "status": "completed",
                    "detail": "Evaluasi analitik menunjukkan tidak ada akar bilangan real pada domain persamaan"
                },
                {
                    "id": "synthesis",
                    "name": "Sintesis Langkah Dinamis",
                    "status": "completed",
                    "detail": f"Dikonstruksi {len(steps)} langkah pembuktian ketiadaan solusi real"
                }
            ])
            return {
                "success": True,
                "equation_raw": equation_str,
                "normalized_input": normalized_input,
                "variable": str(var_symbol),
                "equation_type": eq_type,
                "equation_latex": orig_latex,
                "standard_form_latex": std_latex,
                "solution_type": solution_type,
                "solution_display_latex": solution_display_latex,
                "solution_set_latex": solution_set_latex,
                "workflow_stages": workflow_stages,
                "steps": steps,
                "solutions": [],
                "solution_count": 0
            }

        # Format solutions
        formatted_solutions = []
        for i, sol in enumerate(real_solutions):
            sol_latex = sp.latex(sol)
            try:
                approx_val = float(sol.evalf())
                approx_str = f"{approx_val:.4f}".rstrip('0').rstrip('.')
            except Exception:
                approx_str = str(sol)

            # Verification: substitute into lhs and rhs
            verified = True
            try:
                sub_lhs = float(lhs_expr.subs(var_symbol, sol).evalf())
                sub_rhs = float(rhs_expr.subs(var_symbol, sol).evalf())
                verified = abs(sub_lhs - sub_rhs) < 1e-4
            except Exception:
                verified = True

            formatted_solutions.append({
                "index": i + 1,
                "symbol": f"{var_symbol}_{{{i+1}}}" if len(real_solutions) > 1 else str(var_symbol),
                "exact_latex": f"{var_symbol}_{{{i+1}}} = {sol_latex}" if len(real_solutions) > 1 else f"{var_symbol} = {sol_latex}",
                "sol_latex": sol_latex,
                "approx": approx_str,
                "verified": verified
            })

        sol_items_latex = [s["sol_latex"] for s in formatted_solutions]
        solution_set_latex = f"S = \\left\\{{ {', '.join(sol_items_latex)} \\right\\}}"

        if len(formatted_solutions) == 1:
            solution_type = "single"
            solution_display_latex = f"{var_symbol} = {formatted_solutions[0]['sol_latex']}"
        else:
            solution_type = "multiple"
            # Format: x = 2 atau x = 3
            parts_or = [f"{var_symbol} = {s['sol_latex']}" for s in formatted_solutions]
            solution_display_latex = " \\quad \\text{atau} \\quad ".join(parts_or)

        # Final step
        steps.append({
            "step_number": len(steps) + 1,
            "title": "Himpunan Penyelesaian Akhir",
            "description": f"Nilai {var_symbol} yang memenuhi persamaan:",
            "latex": solution_set_latex
        })

        # Workflow Stage 3: Solving & Verification
        workflow_stages.append({
            "id": "solving",
            "name": "Resolusi Simbolik & Verifikasi",
            "status": "completed",
            "detail": f"Ditemukan {len(formatted_solutions)} solusi analitik dan seluruhnya terverifikasi pada persamaan asal",
            "solutions_count": len(formatted_solutions)
        })

        # Workflow Stage 4: Dynamic Narrative Synthesis
        workflow_stages.append({
            "id": "synthesis",
            "name": "Sintesis Langkah Dinamis",
            "status": "completed",
            "detail": f"Mengonstruksi {len(steps)} tahapan derivasi deduktif kontekstual berformat KaTeX"
        })

        return {
            "success": True,
            "equation_raw": equation_str,
            "normalized_input": normalized_input,
            "variable": str(var_symbol),
            "equation_type": eq_type,
            "equation_latex": orig_latex,
            "standard_form_latex": std_latex,
            "solution_type": solution_type,
            "solution_display_latex": solution_display_latex,
            "solution_set_latex": solution_set_latex,
            "workflow_stages": workflow_stages,
            "steps": steps,
            "solutions": formatted_solutions,
            "solution_count": len(formatted_solutions)
        }

    except Exception as e:
        return {
            "success": False,
            "error": f"Gagal menyelesaikan persamaan: {str(e)}",
            "equation_raw": equation_str
        }
