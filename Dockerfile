# Multi-stage Dockerfile cho Backend .NET 8 Web API (Clean Architecture)

# Stage 1: Build & Publish
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy project files để tận dụng layer caching khi restore NuGet
COPY ["src/Quanlycongviec.Domain/Quanlycongviec.Domain.csproj", "src/Quanlycongviec.Domain/"]
COPY ["src/Quanlycongviec.Application/Quanlycongviec.Application.csproj", "src/Quanlycongviec.Application/"]
COPY ["src/Quanlycongviec.Infrastructure/Quanlycongviec.Infrastructure.csproj", "src/Quanlycongviec.Infrastructure/"]
COPY ["src/Quanlycongviec.Api/Quanlycongviec.Api.csproj", "src/Quanlycongviec.Api/"]

RUN dotnet restore "src/Quanlycongviec.Api/Quanlycongviec.Api.csproj"

# Copy toàn bộ mã nguồn backend và build
COPY . .
WORKDIR "/src/src/Quanlycongviec.Api"
RUN dotnet publish "Quanlycongviec.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Stage 2: Production Runtime
FROM mcr.microsoft.com/dotnet/aspnet:8.0-alpine AS final
WORKDIR /app

# Cài đặt thư viện ICU hỗ trợ xử lý tiếng Việt trên Alpine Linux
RUN apk add --no-cache icu-libs
ENV DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=false

# Tạo thư mục lưu trữ file tải lên
RUN mkdir -p /app/uploads /app/scripts/database

# Copy kết quả biên dịch từ stage build
COPY --from=build /app/publish .

# Copy file SQL khởi tạo database thực tế
COPY scripts/database/seed_database.sql /app/scripts/database/seed_database.sql

ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production

EXPOSE 8080

ENTRYPOINT ["dotnet", "Quanlycongviec.Api.dll"]
