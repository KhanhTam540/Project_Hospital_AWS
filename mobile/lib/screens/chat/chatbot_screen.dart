// lib/screens/chat/chatbot_screen.dart
import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../auth/auth_provider.dart';
import '../../services/chatbot_service.dart';

class ChatbotScreen extends StatefulWidget {
  const ChatbotScreen({super.key});

  @override
  State<ChatbotScreen> createState() => _ChatbotScreenState();
}

class _ChatbotScreenState extends State<ChatbotScreen> {
  // (Giá»¯ nguyÃªn toÃ n bá»™ logic state, initState, _scrollToBottom, _loadHistory, _handleSend)
  final _service = ChatbotService();
  final _controller = TextEditingController();
  final _scrollController = ScrollController();
  List<Map<String, dynamic>> _messages = [];
  bool _isLoading = true;
  bool _isTyping = false;

  @override
  void initState() {
    super.initState();
    _loadHistory();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _loadHistory() async {
    setState(() {
      _messages = [
        {
          'sender': 'bot',
          'text':
              'Xin chÃ o! TÃ´i lÃ  trá»£ lÃ½ AI. TÃ´i cÃ³ thá»ƒ giÃºp gÃ¬ cho báº¡n?',
        },
      ];
    });
    final history = await _service.getHistory();
    setState(() {
      _messages.addAll(history);
      _isLoading = false;
    });
    _scrollToBottom();
  }

  Future<void> _handleSend() async {
    final text = _controller.text.trim();
    if (text.isEmpty) return;

    final user = Provider.of<AuthProvider>(context, listen: false);
    final userName = user.maTK ?? 'User';

    _controller.clear();
    setState(() {
      _messages.add({'sender': userName, 'text': text});
      _isTyping = true;
    });
    _scrollToBottom();

    final reply = await _service.sendMessage(text);

    setState(() {
      _messages.add({'sender': 'bot', 'text': reply});
      _isTyping = false;
    });
    _scrollToBottom();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        title: Text('Trá»£ lÃ½ AI'),
        backgroundColor: Theme.of(context).colorScheme.primary,
        actions: [
          IconButton(
            icon: FaIcon(FontAwesomeIcons.house, color: Colors.white, size: 20),
            tooltip: 'Trang chá»§',
            // --- Sá»¬A á»ž ÄÃ‚Y ---
            // NÃºt Home Ä‘á»™ng dá»±a trÃªn vai trÃ²
            onPressed: () {
              final auth = Provider.of<AuthProvider>(context, listen: false);
              final role = auth.role;
              final loaiNS = auth.loaiNS;
              String homeRoute = '/login'; // Máº·c Ä‘á»‹nh

              switch (role) {
                case 'ADMIN':
                  homeRoute = '/admin';
                  break;
                case 'BACSI':
                  homeRoute = '/doctor';
                  break;
                case 'BENHNHAN':
                  homeRoute = '/patient';
                  break;
                case 'NHANSU':
                  switch (loaiNS) {
                    case 'YT':
                      homeRoute = '/yta';
                      break;
                    case 'XN':
                      homeRoute = '/xetnghiem';
                      break;
                    case 'TN':
                      homeRoute = '/tiepnhan';
                      break;
                  }
                  break;
              }
              context.go(homeRoute);
            },
            // --- Káº¾T THÃšC Sá»¬A ---
          ),
          IconButton(
            icon: FaIcon(
              FontAwesomeIcons.rightFromBracket,
              color: Colors.white,
              size: 20,
            ),
            tooltip: 'ÄÄƒng xuáº¥t',
            onPressed: () async {
              await Provider.of<AuthProvider>(context, listen: false).logout();
              if (!context.mounted) return;
              context.go('/login');
            },
          ),
        ],
      ),
      // (Giá»¯ nguyÃªn pháº§n body, _buildMessageBubble, _buildInputArea)
      body: Column(
        children: [
          Expanded(
            child: _isLoading
                ? Center(child: CircularProgressIndicator())
                : ListView.builder(
                    controller: _scrollController,
                    padding: EdgeInsets.all(16),
                    itemCount: _messages.length + (_isTyping ? 1 : 0),
                    itemBuilder: (context, index) {
                      if (_isTyping && index == _messages.length) {
                        return _buildMessageBubble(
                          'bot',
                          'Bot Ä‘ang gÃµ...',
                          true,
                        );
                      }
                      final msg = _messages[index];
                      return _buildMessageBubble(
                        msg['sender'],
                        msg['text'],
                        false,
                      );
                    },
                  ),
          ),
          _buildInputArea(),
        ],
      ),
    );
  }

  Widget _buildMessageBubble(String sender, String text, bool isTyping) {
    final user = Provider.of<AuthProvider>(context, listen: false);
    final userName = user.maTK ?? 'User';
    bool isUser = sender == userName;
    bool isBot = sender == 'bot';

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6.0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: isUser
            ? MainAxisAlignment.end
            : MainAxisAlignment.start,
        children: [
          if (isBot)
            CircleAvatar(
              backgroundColor: Colors.purple[600],
              child: FaIcon(
                FontAwesomeIcons.robot,
                color: Colors.white,
                size: 20,
              ),
            ),
          SizedBox(width: 10),
          Flexible(
            child: Container(
              padding: EdgeInsets.symmetric(vertical: 12, horizontal: 18),
              decoration: BoxDecoration(
                color: isUser ? Colors.blue[600] : Colors.white,
                borderRadius: isUser
                    ? BorderRadius.only(
                        topLeft: Radius.circular(20),
                        bottomLeft: Radius.circular(20),
                        bottomRight: Radius.circular(20),
                        topRight: Radius.circular(5),
                      )
                    : BorderRadius.only(
                        topLeft: Radius.circular(5),
                        bottomLeft: Radius.circular(20),
                        bottomRight: Radius.circular(20),
                        topRight: Radius.circular(20),
                      ),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.05),
                    blurRadius: 5,
                    offset: Offset(0, 3),
                  ),
                ],
              ),
              child: Text(
                text,
                style: TextStyle(
                  color: isUser ? Colors.white : Colors.black87,
                  fontSize: 16,
                ),
              ),
            ),
          ),
          SizedBox(width: 10),
          if (isUser)
            CircleAvatar(
              backgroundColor: Colors.blue[600],
              child: FaIcon(
                FontAwesomeIcons.user,
                color: Colors.white,
                size: 20,
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildInputArea() {
    return Container(
      padding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: Offset(0, -5),
          ),
        ],
      ),
      child: SafeArea(
        child: Row(
          children: [
            Expanded(
              child: TextField(
                controller: _controller,
                textCapitalization: TextCapitalization.sentences,
                decoration: InputDecoration(
                  hintText: 'Nháº­p tin nháº¯n...',
                  fillColor: Theme.of(
                    context,
                  ).colorScheme.surfaceContainerHighest,
                  filled: true,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(30),
                    borderSide: BorderSide.none,
                  ),
                  contentPadding: EdgeInsets.symmetric(
                    horizontal: 20,
                    vertical: 14,
                  ),
                ),
                onSubmitted: (_) => _handleSend(),
              ),
            ),
            SizedBox(width: 10),
            FloatingActionButton(
              onPressed: _handleSend,
              backgroundColor: Colors.blue[600],
              elevation: 0,
              mini: true,
              child: Icon(Icons.send, color: Colors.white),
            ),
          ],
        ),
      ),
    );
  }
}
