import 'package:flutter/material.dart';

import '../../services/hospital_api_service.dart';
import '../../widgets/hospital_ui.dart';

class AiAssistantScreen extends StatefulWidget {
  const AiAssistantScreen({super.key});

  @override
  State<AiAssistantScreen> createState() => _AiAssistantScreenState();
}

class _AiMessage {
  const _AiMessage({required this.text, required this.fromUser});
  final String text;
  final bool fromUser;
}

class _AiAssistantScreenState extends State<AiAssistantScreen> {
  final HospitalApiService _service = HospitalApiService();
  final TextEditingController _controller = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  final List<_AiMessage> _messages = [
    const _AiMessage(
      text:
          'Xin chào! Tôi là trợ lý của Hospital P2TB. Tôi có thể hướng dẫn quy trình khám, '
          'giải thích thông tin chung và tóm tắt dữ liệu. Tôi không thay thế bác sĩ.',
      fromUser: false,
    ),
  ];
  bool _sending = false;

  @override
  void dispose() {
    _controller.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _send([String? prompt]) async {
    final message = (prompt ?? _controller.text).trim();
    if (message.isEmpty || _sending) return;
    setState(() {
      _messages.add(_AiMessage(text: message, fromUser: true));
      _sending = true;
      _controller.clear();
    });
    _scrollToEnd();

    try {
      final response = await _service.aiChat(message);
      final answer = firstText(response, const [
        'answer',
        'reply',
        'message',
        'output',
        'text',
      ], fallback: formatValue(response));
      if (!mounted) return;
      setState(() => _messages.add(_AiMessage(text: answer, fromUser: false)));
    } catch (error) {
      if (!mounted) return;
      setState(
        () => _messages.add(
          _AiMessage(
            text: 'Không thể kết nối trợ lý AI: $error',
            fromUser: false,
          ),
        ),
      );
    } finally {
      if (mounted) {
        setState(() => _sending = false);
        _scrollToEnd();
      }
    }
  }

  Future<void> _summarize() async {
    if (_sending) return;
    final summaryPayload = <String, dynamic>{
      'conversation': _messages
          .map(
            (item) => {
              'role': item.fromUser ? 'user' : 'assistant',
              'content': item.text,
            },
          )
          .toList(),
    };
    setState(() => _sending = true);
    try {
      final response = await _service.aiSummary(summaryPayload);
      final answer = firstText(response, const [
        'summary',
        'answer',
        'reply',
        'message',
        'output',
        'text',
      ], fallback: formatValue(response));
      if (!mounted) return;
      setState(
        () => _messages.add(
          _AiMessage(text: 'Tóm tắt:\n$answer', fromUser: false),
        ),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Không thể tóm tắt: $error')));
    } finally {
      if (mounted) {
        setState(() => _sending = false);
        _scrollToEnd();
      }
    }
  }

  void _scrollToEnd() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scrollController.hasClients) return;
      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent,
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOut,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final suggestions = <String>[
      'Tôi cần chuẩn bị gì trước khi đi khám?',
      'Giải thích quy trình đặt lịch khám.',
      'Khi nào cần liên hệ bác sĩ ngay?',
    ];

    return Column(
      children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.fromLTRB(20, 14, 20, 14),
          color: Theme.of(context).colorScheme.surface,
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.primaryContainer,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(
                  Icons.auto_awesome_rounded,
                  color: Theme.of(context).colorScheme.primary,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Trợ lý AI Hospital P2TB',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    Text(
                      'Gemini qua backend /api/ai/chat và /api/ai/summary',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
              IconButton(
                tooltip: 'Tóm tắt cuộc trò chuyện',
                onPressed: _messages.length <= 1 || _sending
                    ? null
                    : _summarize,
                icon: const Icon(Icons.summarize_rounded),
              ),
              IconButton(
                tooltip: 'Xóa cuộc trò chuyện',
                onPressed: () {
                  setState(() {
                    _messages
                      ..clear()
                      ..add(
                        const _AiMessage(
                          text:
                              'Cuộc trò chuyện mới đã bắt đầu. Bạn cần hỗ trợ gì?',
                          fromUser: false,
                        ),
                      );
                  });
                },
                icon: const Icon(Icons.delete_sweep_rounded),
              ),
            ],
          ),
        ),
        Expanded(
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 900),
              child: ListView(
                controller: _scrollController,
                padding: const EdgeInsets.fromLTRB(16, 20, 16, 20),
                children: [
                  HospitalCard(
                    backgroundColor: Theme.of(
                      context,
                    ).colorScheme.errorContainer.withValues(alpha: 0.48),
                    borderColor: Theme.of(
                      context,
                    ).colorScheme.error.withValues(alpha: 0.25),
                    child: const Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(Icons.health_and_safety_outlined),
                        SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            'Không nhập CCCD, BHYT, số điện thoại hoặc thông tin nhận dạng. '
                            'AI chỉ hỗ trợ thông tin chung và không đưa ra chẩn đoán thay bác sĩ.',
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: suggestions
                        .map(
                          (text) => ActionChip(
                            avatar: const Icon(
                              Icons.lightbulb_outline_rounded,
                              size: 18,
                            ),
                            label: Text(text),
                            onPressed: _sending ? null : () => _send(text),
                          ),
                        )
                        .toList(),
                  ),
                  const SizedBox(height: 16),
                  ..._messages.map(
                    (message) => Align(
                      alignment: message.fromUser
                          ? Alignment.centerRight
                          : Alignment.centerLeft,
                      child: Container(
                        constraints: const BoxConstraints(maxWidth: 700),
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 13,
                        ),
                        decoration: BoxDecoration(
                          color: message.fromUser
                              ? Theme.of(context).colorScheme.primary
                              : Theme.of(context).colorScheme.surface,
                          borderRadius: BorderRadius.only(
                            topLeft: const Radius.circular(18),
                            topRight: const Radius.circular(18),
                            bottomLeft: Radius.circular(
                              message.fromUser ? 18 : 4,
                            ),
                            bottomRight: Radius.circular(
                              message.fromUser ? 4 : 18,
                            ),
                          ),
                          border: message.fromUser
                              ? null
                              : Border.all(
                                  color: Theme.of(context).dividerColor,
                                ),
                        ),
                        child: SelectableText(
                          message.text,
                          style: TextStyle(
                            color: message.fromUser
                                ? Theme.of(context).colorScheme.onPrimary
                                : Theme.of(context).colorScheme.onSurface,
                            height: 1.45,
                          ),
                        ),
                      ),
                    ),
                  ),
                  if (_sending)
                    const Align(
                      alignment: Alignment.centerLeft,
                      child: Padding(
                        padding: EdgeInsets.all(12),
                        child: CircularProgressIndicator(),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
        SafeArea(
          top: false,
          child: Container(
            color: Theme.of(context).colorScheme.surface,
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 14),
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 900),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _controller,
                        minLines: 1,
                        maxLines: 5,
                        textInputAction: TextInputAction.newline,
                        decoration: const InputDecoration(
                          hintText:
                              'Nhập câu hỏi về quy trình và thông tin sức khỏe chung...',
                          prefixIcon: Icon(Icons.chat_bubble_outline_rounded),
                        ),
                        onSubmitted: (_) => _send(),
                      ),
                    ),
                    const SizedBox(width: 10),
                    FilledButton(
                      onPressed: _sending ? null : _send,
                      style: FilledButton.styleFrom(
                        minimumSize: const Size(54, 54),
                        padding: EdgeInsets.zero,
                      ),
                      child: const Icon(Icons.send_rounded),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
