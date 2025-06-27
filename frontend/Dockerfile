# 빌드 스테이지
FROM node:18-alpine AS builder

WORKDIR /app

# package.json과 package-lock.json 복사
COPY package*.json ./

# 의존성 설치
RUN npm ci --only=production

# 소스 코드 복사
COPY . .

# 프로덕션 빌드
RUN npm run build

# 실행 스테이지
FROM nginx:alpine

# 빌드된 파일을 nginx로 복사
COPY --from=builder /app/build /usr/share/nginx/html

# nginx 설정
COPY nginx.conf /etc/nginx/nginx.conf

# 포트 노출
EXPOSE 80

# nginx 실행
CMD ["nginx", "-g", "daemon off;"] 