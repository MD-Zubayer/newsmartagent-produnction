from rest_framework import serializers
from .models import BlogPost, Category
from django.contrib.auth import get_user_model

User = get_user_model()

class AuthorSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name']

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'slug']

class BlogPostListSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    author = AuthorSerializer(read_only=True)
    thumbnail = serializers.ImageField(use_url=True, required=False)

    class Meta:
        model = BlogPost
        fields = ['id', 'title', 'slug', 'thumbnail', 'category', 'author', 'created_at']

class BlogPostDetailSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    author = AuthorSerializer(read_only=True)
    thumbnail = serializers.ImageField(use_url=True, required=False)

    class Meta:
        model = BlogPost
        fields = ['id', 'title', 'slug', 'thumbnail', 'content', 'meta_description', 'category', 'author', 'created_at', 'updated_at']
