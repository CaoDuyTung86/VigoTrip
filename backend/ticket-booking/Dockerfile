# Build stage
FROM maven:3.9.6-eclipse-temurin-17 AS builder
WORKDIR /app

# Copy the pom.xml and source code
COPY pom.xml .
COPY src ./src

# Build the application
RUN mvn clean package -DskipTests

# Run stage
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# Copy the built jar file
COPY --from=builder /app/target/*.jar app.jar

# Expose the application port
EXPOSE 8080

# Command to run the application with strict RAM limit for Render free tier (512MB total)
#
# -Duser.timezone: container Render mặc định chạy UTC, trong khi code dùng LocalDateTime.now()
# (không kèm zone) để ghi checkInDate/bookingDate và một số service đã cắm cứng
# ZoneId.of("Asia/Ho_Chi_Minh"). Nếu không ép múi giờ cho JVM thì giờ soát vé lưu xuống
# lệch 7 tiếng so với giờ Việt Nam và màn hình soát vé hiển thị "7 giờ trước" cho tấm vé
# vừa quét xong. Đặt ở đây thay vì sửa từng chỗ gọi để không đụng vào logic nghiệp vụ.
ENTRYPOINT ["java", \
  "-Duser.timezone=Asia/Ho_Chi_Minh", \
  "-Xmx256m", \
  "-Xms128m", \
  "-XX:MaxMetaspaceSize=128m", \
  "-XX:+UseSerialGC", \
  "-XX:+UseStringDeduplication", \
  "-jar", "app.jar"]
