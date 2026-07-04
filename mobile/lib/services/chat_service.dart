// lib/services/chat_service.dart
import 'dart:convert';
import 'api_client.dart';
import '../models/user_model.dart'; // Import UserModel của bạn

class ChatService {
  final ApiClient _api = ApiClient();

  // Lấy danh bạ
  Future<List<UserModel>> getContacts() async {
    try {
      final response = await _api.get('/chat/contacts');
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body)['data'] as List;
        return data.map((json) => UserModel.fromJson(json)).toList();
      }
    } catch (e) {
      print('Lỗi tải danh bạ: $e');
    }
    return [];
  }
}
