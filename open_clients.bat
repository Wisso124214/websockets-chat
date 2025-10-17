@echo off
setlocal enabledelayedexpansion

:: Leer configuración desde el archivo config.env
for /f "tokens=1,2 delims==" %%A in (config.env) do (
    if "%%A"=="CLIENT_COUNT" set CLIENT_COUNT=%%B
    if "%%A"=="PORT" set PORT=%%B
    if "%%A"=="IP" set IP=%%B
)

:: Abrir la cantidad de clientes especificada
for /l %%i in (1,1,!CLIENT_COUNT!) do explorer "http://!IP!:!PORT!"