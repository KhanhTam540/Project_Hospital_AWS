import 'dart:convert';

import 'api_client.dart';

class ChatbotService {
  final ApiClient _api = ApiClient();

  Future<List<Map<String, dynamic>>> getHistory() async {
    try {
      final response = await _api.get('/chatbot/history');
      if (response.statusCode != 200) return const [];

      final decoded = jsonDecode(response.body);
      final raw = decoded is Map ? decoded['data'] : null;
      if (raw is! List) return const [];

      return raw.expand<Map<String, dynamic>>((item) {
        if (item is! Map) return const <Map<String, dynamic>>[];
        final message = item['message'] ?? item['text'];
        final reply = item['reply'] ?? item['answer'];
        return [
          if (message != null) {'sender': 'user', 'text': message.toString()},
          if (reply != null) {'sender': 'bot', 'text': reply.toString()},
        ];
      }).toList();
    } catch (_) {
      return const [];
    }
  }

  /// Gọi Gemini qua backend AWS. API key không nằm trong Flutter.
  Future<String> sendMessage(String message) async {
    final trimmed = message.trim();
    if (trimmed.isEmpty) return 'Vui lòng nhập câu hỏi.';

    try {
      final response = await _api.post('/ai/chat', {
        'message': trimmed,
        'context': 'Hospital P2TB mobile application',
      });
      final decoded = jsonDecode(response.body);

      if (response.statusCode < 200 || response.statusCode >= 300) {
        final data = decoded is Map ? decoded : const <String, dynamic>{};
        return (data['message'] ?? 'AI lỗi ${response.statusCode}').toString();
      }

      if (decoded is Map) {
        final data = decoded['data'];
        if (decoded['answer'] != null) return decoded['answer'].toString();
        if (data is Map) {
          final answer = data['answer'] ?? data['reply'];
          if (answer != null) return answer.toString();
        }
      }
      return 'Không nhận được phản hồi từ trợ lý AI.';
    } catch (error) {
      return 'Không thể kết nối trợ lý AI: $error';
    }
  }
}
