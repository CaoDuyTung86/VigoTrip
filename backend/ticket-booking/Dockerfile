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
ENTRYPOINT ["java", \
  "-Xmx256m", \
  "-Xms128m", \
  "-XX:MaxMetaspaceSize=128m", \
  "-XX:+UseSerialGC", \
  "-XX:+UseStringDeduplication", \
  "-jar", "app.jar"]
