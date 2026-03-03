@echo off
setlocal

:: This script performs the relevant steps to create a local docker image for camunda-lint
:: It's possible to provide parameters:
:: -i <image name:tag name> | --image <image name:tag name>
:: -t <token> | --token <token>

:: Set Defaults
set "IMAGE_TAG=camunda-lint-dev:latest"
:: Default token to the environment variable
set "FINAL_TOKEN=%GITHUB_TOKEN%"

:: Parse Arguments Loop
:parse_args
if "%~1"=="" goto start_logic

if /i "%~1"=="-i" set "IMAGE_TAG=%~2" & shift & shift & goto parse_args
if /i "%~1"=="--image" set "IMAGE_TAG=%~2" & shift & shift & goto parse_args

if /i "%~1"=="-t" set "FINAL_TOKEN=%~2" & shift & shift & goto parse_args
if /i "%~1"=="--token" set "FINAL_TOKEN=%~2" & shift & shift & goto parse_args

echo Invalid parameter: %~1
exit /b 1

:start_logic
:: Check if Image Tag is provided
if "%IMAGE_TAG%"=="" (
    echo Error: Image name and tag are required. Please use -i ^<image name:tag name^>
    exit /b 1
)

if "%FINAL_TOKEN%"=="" (
    echo Error: GITHUB_TOKEN is not set. Please set the env var or use -t ^<token^>.
    exit /b 1
)

:: Set the env var for the session so Docker can pick it up
set "GITHUB_TOKEN=%FINAL_TOKEN%"

echo ----------------------------------------
echo --- Building %IMAGE_TAG% ---
echo ----------------------------------------

:: Perform npm install to populate the package-lock.json
echo Install dependencies...
call npm install
if %errorlevel% neq 0 exit /b %errorlevel%


:: Generate SBOM
:: IMPORTANT: In batch files, you must use CALL for npm, or the script exits immediately
echo Generating SBOM...
call npx @cyclonedx/cyclonedx-npm -o camunda-lint-sbom.json
if %errorlevel% neq 0 exit /b %errorlevel%

:: Cleanup existing images
:: Redirect error output to nul so it doesn't complain if image is missing
echo Cleaning up if exists an image...
docker image rm "%IMAGE_TAG%" 2>nul
:: Reset errorlevel here because 'docker image rm' failing is acceptable
ver > nul

:: Build Docker Image
echo Building Docker Image...
set DOCKER_BUILDKIT=1
docker build --secret id=GH_TOKEN,env=GITHUB_TOKEN -t "%IMAGE_TAG%" .
if %errorlevel% neq 0 exit /b %errorlevel%

echo ------------------------------------------------------
echo --- Complete! Image %IMAGE_TAG% built. ---
echo ------------------------------------------------------

endlocal
