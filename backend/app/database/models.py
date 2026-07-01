"""Registro central de todos los modelos.

Importa cada modelo para que queden registrados en ``Base.metadata`` (necesario para Alembic y para
crear el esquema en los tests). Importa este módulo antes de usar la metadata.
"""

from __future__ import annotations

from app.database.base import Base
from app.modules.academic import model as academic_model
from app.modules.audit import model as audit_model
from app.modules.evaluation import model as evaluation_model
from app.modules.iam import model as iam_model
from app.modules.offering import model as offering_model
from app.modules.simulation import model as simulation_model
from app.modules.student import model as student_model

__all__ = [
    "Base",
    "academic_model",
    "audit_model",
    "evaluation_model",
    "iam_model",
    "offering_model",
    "simulation_model",
    "student_model",
]
