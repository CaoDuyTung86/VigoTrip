@echo off
set SONAR_TOKEN=sqa_7efd2af215c21539356527c6b64789c40ea9ec18

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
