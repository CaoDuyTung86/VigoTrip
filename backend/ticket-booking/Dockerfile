# Build stage
FROM maven:3.9.6-eclipse-temurin-17 AS builder
WORKDIR /app

# Tải phụ thuộc TRƯỚC khi copy mã nguồn.
#
# Bản cũ copy luôn cả src rồi mới `mvn clean package`, nên mỗi lần sửa một dòng Java là
# Docker mất cache ở đúng bước đó và Maven tải lại toàn bộ dependency từ Maven Central.
# Đó chính là thứ sinh ra lỗi deploy `status code: 429, reason phrase: Too Many Requests`:
# Central chặn theo IP, mà IP build của Render thì dùng chung cho rất nhiều người.
# Tách riêng bước này thì layer chỉ vỡ khi pom.xml đổi — deploy thường lệ không còn gọi
# ra mạng nữa, vừa nhanh vừa hết bị chặn.
COPY pom.xml .
RUN mvn -B -q dependency:go-offline

# Kèm thêm lưới an toàn cho lần thực sự phải tải: tự thử lại khi Central trả 429/5xx,
# thay vì đổ nguyên bản build. -B tắt output kiểu progress bar cho log Render dễ đọc.
ENV MAVEN_OPTS="-Dmaven.wagon.http.retryHandler.count=5 -Dmaven.wagon.httpconnectionManager.ttlSeconds=120 -Dmaven.wagon.http.pool=false"

COPY src ./src
RUN mvn -B clean package -DskipTests

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
