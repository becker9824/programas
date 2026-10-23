@echo off
rem Abre la app de Programas (doble clic aqui).
start "" powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0servidor.ps1"
