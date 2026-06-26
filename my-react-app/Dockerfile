FROM nginx:alpine

# Copy thư mục dist đã build ở local vào thư mục web của Nginx
COPY dist /usr/share/nginx/html

# Copy cấu hình Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
