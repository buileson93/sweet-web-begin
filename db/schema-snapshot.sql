-- Ảnh chụp schema dạng văn bản chuẩn hoá, dùng để so sánh hai CSDL.
-- Chạy: psql -At -f db/schema-snapshot.sql <dsn> | sort > out.txt
-- Chỉ đọc pg_catalog, không phụ thuộc pg_dump, không đụng tới dữ liệu.

\pset tuples_only on
\pset format unaligned

SELECT 'ENUM|' || t.typname || '|' ||
       string_agg(quote_literal(e.enumlabel), ',' ORDER BY e.enumsortorder)
FROM pg_type t
JOIN pg_enum e ON e.enumtypid = t.oid
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public'
GROUP BY t.typname;

SELECT 'COLUMN|' || c.relname || '|' || a.attname || '|' ||
       format_type(a.atttypid, a.atttypmod) || '|' ||
       a.attnotnull || '|' || coalesce(pg_get_expr(d.adbin, d.adrelid), '')
FROM pg_attribute a
JOIN pg_class c ON c.oid = a.attrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
WHERE n.nspname = 'public' AND c.relkind = 'r' AND a.attnum > 0 AND NOT a.attisdropped;

SELECT 'CONSTRAINT|' || rel.relname || '|' || con.conname || '|' || pg_get_constraintdef(con.oid)
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_namespace n ON n.oid = rel.relnamespace
WHERE n.nspname = 'public';

SELECT 'INDEX|' || indexdef FROM pg_indexes WHERE schemaname = 'public';

SELECT 'RLS|' || c.relname || '|' || c.relrowsecurity
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r';

SELECT 'POLICY|' || schemaname || '|' || tablename || '|' || policyname || '|' || cmd || '|' ||
       coalesce(array_to_string(roles, ','), '') || '|' ||
       coalesce(qual, '-') || '|' || coalesce(with_check, '-')
FROM pg_policies
WHERE schemaname IN ('public', 'storage');

SELECT 'TABLEACL|' || c.relname || '|' || coalesce(array_to_string(c.relacl, ' '), '-')
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r';

SELECT 'COLACL|' || c.relname || '|' || a.attname || '|' || array_to_string(a.attacl, ' ')
FROM pg_attribute a
JOIN pg_class c ON c.oid = a.attrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND a.attacl IS NOT NULL;

SELECT 'FUNCTION|' || p.proname || '|' || md5(pg_get_functiondef(p.oid)) || '|' ||
       coalesce(array_to_string(p.proacl, ' '), '-')
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public';

SELECT 'TRIGGER|' || pg_get_triggerdef(t.oid)
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND NOT t.tgisinternal;

SELECT 'BUCKET|' || id || '|' || name || '|' || public FROM storage.buckets;

SELECT 'PUBLICATION|' || pubname || '|' || schemaname || '|' || tablename || '|' ||
       coalesce(array_to_string(attnames, ','), '')
FROM pg_publication_tables
WHERE schemaname = 'public';

SELECT 'EXTENSION|' || extname FROM pg_extension WHERE extname IN ('pgcrypto', 'uuid-ossp');
