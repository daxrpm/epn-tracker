"""Study resources (recursos): files and links attached to a catalog course.

Students upload apuntes/material per materia, classified by bimestre (Contribution),
tema and academic period. Moderation mirrors the evaluation-scheme community pattern
(Visibility + votes + approval_count). File bytes live in MinIO/S3; only metadata is in
Postgres. ``extracted_text`` is kept for a future AI/vectorization phase.
"""
