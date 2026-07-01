"""Extract EPN curriculum seed data from the official vector PDFs.

The source PDFs use consistently positioned course cards. This script reads Poppler's
``pdftotext -bbox-layout`` output, associates each course code with its credit header and term,
and writes import-ready JSON payloads consumed by ``python -m seeds.loader``.
"""

from __future__ import annotations

import argparse
import json
import math
import re
import subprocess
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PDF_DIR = ROOT / "mallas"
OUTPUT_DIR = ROOT / "backend" / "seeds" / "data"

PDF_CONFIG = {
    "malla_computacion.pdf": {
        "output": "computacion_2020.json",
        "career": "Computación",
        "degree_title": "Ingeniero/a en Ciencias de la Computación",
        "pensum_year": 2020,
        "reported": 48,
    },
    "malla_software.pdf": {
        "output": "software_2020.json",
        "career": "Software",
        "degree_title": "Ingeniero/a de Software",
        "pensum_year": 2020,
        "reported": 49,
    },
    "malla_sistemas_informacion.pdf": {
        "output": "sistemas_informacion_2023.json",
        "career": "Sistemas de Información",
        "degree_title": "Ingeniero/a en Sistemas de Información",
        "pensum_year": 2023,
        "reported": 49,
    },
    "malla_ciencia_datos_IA.pdf": {
        "output": "ciencia_datos_ia_2023.json",
        "career": "Ciencia de Datos e Inteligencia Artificial",
        "degree_title": "Ingeniero/a en Ciencia de Datos e Inteligencia Artificial",
        "pensum_year": 2023,
        "reported": 50,
    },
}

GRADUATION_REQUIREMENTS = [
    {"code": "IEXD200", "name": "Nivel de Suficiencia B1 en el idioma inglés", "type": "ENGLISH"},
    {"code": "DEPD110", "name": "Deportes", "type": "SPORTS"},
    {"code": "SOCD210", "name": "Clubes", "type": "CLUBS"},
    {"code": "CSHD500", "name": "Asignatura de Comunicación", "type": "SOCIAL"},
    {"code": "ADMD700", "name": "Emprendimiento", "type": "ENTREPRENEURSHIP"},
    {"code": "ADMD800", "name": "Formulación y Evaluación de Proyectos", "type": "PROJECTS"},
    {"code": "AMBD900", "name": "Ecología y Ambiente", "type": "ENVIRONMENT"},
]

COURSE_CODE = re.compile(r"[A-Z]{4}\d{3}")


@dataclass(frozen=True)
class Block:
    text: str
    x_min: float
    y_min: float
    x_max: float
    y_max: float

    @property
    def x_center(self) -> float:
        return (self.x_min + self.x_max) / 2

    @property
    def y_center(self) -> float:
        return (self.y_min + self.y_max) / 2


def pdf_blocks(path: Path) -> list[Block]:
    raw = subprocess.check_output(["pdftotext", "-bbox-layout", str(path), "-"], text=True)
    root = ET.fromstring(raw)
    namespace = {"x": "http://www.w3.org/1999/xhtml"}
    blocks: list[Block] = []
    for node in root.findall(".//x:block", namespace):
        lines: list[str] = []
        for line in node.findall("x:line", namespace):
            words = [word.text or "" for word in line.findall("x:word", namespace)]
            if words:
                lines.append(" ".join(words))
        if not lines:
            continue
        blocks.append(
            Block(
                text=" ".join(lines),
                x_min=float(node.attrib["xMin"]),
                y_min=float(node.attrib["yMin"]),
                x_max=float(node.attrib["xMax"]),
                y_max=float(node.attrib["yMax"]),
            )
        )
    return blocks


def extract_courses(path: Path) -> tuple[list[dict[str, object]], list[tuple[str, float, float]]]:
    blocks = pdf_blocks(path)
    credit_blocks = [b for b in blocks if b.text.startswith("CRÉDITOS HORAS ")]
    term_blocks = [
        b for b in blocks if b.text in {str(term) for term in range(1, 10)} and b.x_max < 55
    ]
    code_blocks = [b for b in blocks if COURSE_CODE.fullmatch(b.text)]

    candidates: list[tuple[dict[str, object], Block, Block]] = []
    for code in code_blocks:
        headers = [
            header
            for header in credit_blocks
            if abs(header.x_center - code.x_center) < 15 and 35 < code.y_min - header.y_min < 95
        ]
        if not headers:
            continue
        header = min(headers, key=lambda item: code.y_min - item.y_min)
        numbers = re.findall(r"\d+", header.text)
        if len(numbers) < 2:
            continue

        name_blocks = [
            block
            for block in blocks
            if header.y_max < block.y_center < code.y_min
            and header.x_min - 8 < block.x_center < header.x_max + 8
            and block is not header
            and not COURSE_CODE.fullmatch(block.text)
        ]
        if not name_blocks:
            continue
        name = " ".join(block.text for block in sorted(name_blocks, key=lambda item: item.y_min))
        name = normalize_course_name(name)
        term = min(term_blocks, key=lambda item: abs(item.y_center - code.y_center))
        term_number = int(term.text)

        normalized_code = code.text
        # The Computación PDF repeats CSHD400 for two different subjects. Other official FIS
        # curricula identify Artes y Humanidades as CSHD300, which also preserves catalog
        # uniqueness inside the curriculum.
        if normalized_code == "CSHD400" and "Artes Y Humanidades" in name:
            normalized_code = "CSHD300"

        candidates.append(
            (
                {
                    "code": normalized_code,
                    "name": name,
                    "credits": numbers[-2],
                    "hours": int(numbers[-1]),
                    "reference_term": term_number,
                    "organization_unit": organization_unit(code.text, term_number),
                    "requirements": [],
                },
                code,
                header,
            )
        )

    # Requirement labels printed below a card can be mistaken for course codes because a new
    # credit header starts nearby. Real course placement is always the earliest occurrence.
    selected: dict[str, tuple[dict[str, object], Block, Block]] = {}
    for course, block, header in sorted(
        candidates, key=lambda item: (int(item[0]["reference_term"]), item[1].x_center)
    ):
        selected.setdefault(str(course["code"]), (course, block, header))

    used_code_blocks = {block for _, block, _ in selected.values()}
    courses = [course for course, _, _ in selected.values()]
    courses.sort(
        key=lambda item: (
            int(item["reference_term"]),
            selected[str(item["code"])][1].x_center,
        )
    )

    course_codes = set(selected)
    for requirement_block in code_blocks:
        if requirement_block in used_code_blocks or requirement_block.text not in course_codes:
            continue
        targets = [
            (course, course_block)
            for course, course_block, _ in selected.values()
            if abs(course_block.x_center - requirement_block.x_center) < 18
            and 0 < course_block.y_center - requirement_block.y_center < 110
        ]
        if not targets:
            continue
        target, _ = min(
            targets,
            key=lambda item: item[1].y_center - requirement_block.y_center,
        )
        if target["code"] != requirement_block.text:
            add_requirement(target, "PREREQUISITE", requirement_block.text)

    add_vector_requirements(path, selected)

    extras = [
        (block.text, block.x_center, block.y_center)
        for block in code_blocks
        if block not in used_code_blocks
    ]
    return courses, extras


def add_vector_requirements(
    path: Path,
    selected: dict[str, tuple[dict[str, object], Block, Block]],
) -> None:
    """Map vector connector endpoints to source course codes and destination cards."""
    raw = subprocess.check_output(["pdftocairo", "-svg", str(path), "-"], text=True)
    root = ET.fromstring(raw)
    namespace = {"s": "http://www.w3.org/2000/svg"}
    coordinate = r"(-?\d+(?:\.\d+)?)"

    for node in root.findall(".//s:path", namespace):
        if node.attrib.get("stroke-width") != "0.75" or node.attrib.get("fill") != "none":
            continue
        points = re.findall(rf"[ML]\s*{coordinate}\s+{coordinate}", node.attrib.get("d", ""))
        matrix = re.fullmatch(
            rf"matrix\({coordinate},\s*{coordinate},\s*{coordinate},\s*{coordinate},\s*{coordinate},\s*{coordinate}\)",
            node.attrib.get("transform", ""),
        )
        if len(points) < 2 or matrix is None:
            continue

        transform_matrix = tuple(float(value) for value in matrix.groups())
        source_point = transform_point(transform_matrix, points[0])
        target_point = transform_point(transform_matrix, points[-1])

        source_options = [
            (course, code_block)
            for course, code_block, _ in selected.values()
            if abs(code_block.x_center - source_point[0]) < 45
            and abs(code_block.y_max - source_point[1]) < 16
        ]
        target_options = [
            (course, header)
            for course, _, header in selected.values()
            if abs(header.x_center - target_point[0]) < 45
            and abs(header.y_min - target_point[1]) < 18
        ]
        if not source_options or not target_options:
            continue

        source, _ = min(
            source_options,
            key=lambda item: math.dist((item[1].x_center, item[1].y_max), source_point),
        )
        target, _ = min(
            target_options,
            key=lambda item: math.dist((item[1].x_center, item[1].y_min), target_point),
        )
        source_term = int(source["reference_term"])
        target_term = int(target["reference_term"])
        if source["code"] == target["code"] or source_term > target_term:
            continue
        requirement_type = "COREQUISITE" if source_term == target_term else "PREREQUISITE"
        add_requirement(target, requirement_type, str(source["code"]))


def add_requirement(course: dict[str, object], kind: str, required_code: str) -> None:
    requirements = course["requirements"]
    assert isinstance(requirements, list)
    requirement = {"type": kind, "course_code": required_code}
    if requirement not in requirements:
        requirements.append(requirement)


def transform_point(matrix: tuple[float, ...], point: tuple[str, str]) -> tuple[float, float]:
    a, b, c, d, e, f = matrix
    x, y = (float(value) for value in point)
    return a * x + c * y + e, b * x + d * y + f


def normalize_course_name(name: str) -> str:
    normalized = re.sub(r"\s+", " ", name).strip().title()
    for original, replacement in {
        " Ii": " II",
        " Iii": " III",
        " Iv": " IV",
        " Big Data": " Big Data",
    }.items():
        normalized = normalized.replace(original, replacement)
    return normalized


def organization_unit(code: str, term: int) -> str:
    if code.startswith("TITD"):
        return "CAPSTONE"
    if term <= 2 or code.startswith(("MATD", "FISD")):
        return "BASIC"
    return "PROFESSIONAL"


def payload_for(
    path: Path, config: dict[str, object]
) -> tuple[dict[str, object], list[tuple[str, float, float]]]:
    courses, extras = extract_courses(path)
    total_credits = sum(int(str(course["credits"])) for course in courses)
    payload: dict[str, object] = {
        "institution": {"name": "Escuela Politécnica Nacional", "acronym": "EPN"},
        "faculty": {"name": "Facultad de Ingeniería de Sistemas", "acronym": "FIS"},
        "career": {
            "name": config["career"],
            "degree_title": config["degree_title"],
        },
        "curriculum": {
            "pensum_year": config["pensum_year"],
            "total_terms": 9,
            "total_credits": str(total_credits),
            "total_hours": 6480,
            "total_courses_reported": config["reported"],
        },
        "courses": courses,
        "graduation_requirements": GRADUATION_REQUIREMENTS,
    }
    return payload, extras


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true", help="write JSON files to seeds/data")
    parser.add_argument("--show-extra-codes", action="store_true")
    args = parser.parse_args()

    for filename, config in PDF_CONFIG.items():
        payload, extras = payload_for(PDF_DIR / filename, config)
        courses = payload["courses"]
        assert isinstance(courses, list)
        # The official "Número de asignaturas" excludes the two credited practice activities,
        # which are still represented as curriculum courses because they carry 7/135 credits.
        expected = int(config["reported"]) + 2
        status = "OK" if len(courses) == expected else "MISMATCH"
        total = payload["curriculum"]["total_credits"]  # type: ignore[index]
        print(f"{filename}: {len(courses)}/{expected} courses, {total} credits [{status}]")
        if args.show_extra_codes:
            print("  extra codes:", extras)
        if args.write:
            output = OUTPUT_DIR / str(config["output"])
            output.write_text(
                json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
            )
            print(f"  wrote {output.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
