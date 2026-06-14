$connStr = "postgresql://neondb_owner:npg_rYm5u2NFKfUl@ep-ancient-bread-atmgyfei-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require"
$migrationFile = "c:\Users\ESTUDIANTE\Desktop\mediVidriosPro\backend\migrations\001_initial.sql"
$psqlPath = "C:\Program Files\PostgreSQL\16\bin\psql.exe"

Write-Host "Ejecutando migracion en Neon PostgreSQL..."
& $psqlPath $connStr -f $migrationFile
Write-Host "Migracion completada."