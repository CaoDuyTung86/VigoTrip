@echo off
if "%SONAR_TOKEN%"=="" (
  echo ERROR: Bien moi truong SONAR_TOKEN chua duoc set.
  echo Chay lenh sau mot lan roi mo terminal moi:  setx SONAR_TOKEN "sqa_xxx"
  exit /b 1
)

echo ================================================
echo    DANG QUET BACKEND (JAVA)
echo ================================================
cd backend/ticket-booking
call ./mvnw clean verify sonar:sonar -Dsonar.projectKey=Ticket-Booking -Dsonar.host.url=http://localhost:9000 -Dsonar.token=%SONAR_TOKEN%

echo.
echo ================================================
echo    DANG QUET FRONTEND (REACT)
echo ================================================
cd ../../my-react-app
call npx sonarqube-scanner -Dsonar.token=%SONAR_TOKEN%

echo.
echo ================================================
echo    HOAN TAT! XEM KET QUA TAI: http://localhost:9000
echo ================================================
pause
