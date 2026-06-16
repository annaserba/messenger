import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../models/chat.dart';
import '../../models/message.dart';
import '../auth/auth_redirect.dart';
import '../auth/login_screen.dart';

class MessengerHome extends StatefulWidget {
  const MessengerHome({super.key});

  @override
  State<MessengerHome> createState() => _MessengerHomeState();
}

class _MessengerHomeState extends State<MessengerHome> {
  final _api = ApiClient();
  final _nameController = TextEditingController(text: 'Анна');
  final _messageController = TextEditingController();
  final _messageFocus = FocusNode();

  List<Chat> _chats = [];
  String _userName = 'Анна';
  int _selectedChatIndex = 0;
  bool _isTyping = false;
  bool _isSignedIn = false;
  bool _isLoading = false;
  String? _error;
  Timer? _pollingTimer;

  @override
  void initState() {
    super.initState();
    _consumeAuthRedirect();
  }

  @override
  void dispose() {
    _pollingTimer?.cancel();
    _nameController.dispose();
    _messageController.dispose();
    _messageFocus.dispose();
    super.dispose();
  }

  Chat? get _selectedChat {
    if (_chats.isEmpty) return null;
    final safeIndex = _selectedChatIndex.clamp(0, _chats.length - 1);
    return _chats[safeIndex];
  }

  Future<void> _consumeAuthRedirect() async {
    final redirect = readAuthRedirect();
    if (redirect == null) return;

    setState(() {
      _userName = redirect.name;
      _api.accessToken = redirect.accessToken;
      _nameController.text = redirect.name;
      _isSignedIn = true;
      _error = null;
    });

    await _loadChats();
    _startPolling();
  }

  Future<void> _signInWithYandex() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final authUrlResponse = await _api.getYandexAuthUrl();
      if (authUrlResponse['configured'] == true) {
        openAuthUrl(authUrlResponse['url'] as String);
        return;
      }

      final response = await _api.signInWithYandexDemo();
      final user = response['user'] as Map<String, dynamic>;
      final name = user['name'] as String? ?? 'Пользователь';

      setState(() {
        _userName = name;
        _api.accessToken = response['accessToken'] as String?;
        _nameController.text = name;
        _isSignedIn = true;
      });

      await _loadChats();
      _startPolling();
      if (mounted) {
        setState(() {
          _error = 'Яндекс OAuth не настроен, включён демо-вход.';
        });
      }
    } catch (_) {
      setState(() {
        _error = 'Не удалось войти через Яндекс. Проверьте backend.';
      });
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _loadChats() async {
    final response = await _api.fetchChats();
    final nextChats = (response['chats'] as List<dynamic>)
        .map((item) => Chat.fromJson(item as Map<String, dynamic>, _userName))
        .toList();

    if (!mounted) return;
    setState(() {
      _chats = nextChats;
      if (_selectedChatIndex >= _chats.length) {
        _selectedChatIndex = 0;
      }
    });
  }

  void _startPolling() {
    _pollingTimer?.cancel();
    _pollingTimer = Timer.periodic(const Duration(seconds: 2), (_) async {
      if (!_isSignedIn) return;
      try {
        await _loadChats();
      } catch (_) {
        // Keep the current chat state visible if a poll fails.
      }
    });
  }

  void _saveName() {
    final nextName = _nameController.text.trim();
    if (nextName.isEmpty) return;

    setState(() {
      _userName = nextName;
      _chats = _chats
          .map((chat) => Chat.fromJson(chat.toJson(), nextName))
          .toList();
    });
    _messageFocus.requestFocus();
  }

  void _selectChat(int index) {
    setState(() {
      _selectedChatIndex = index;
      _isTyping = false;
    });
    _messageFocus.requestFocus();
  }

  Future<void> _sendMessage() async {
    final chat = _selectedChat;
    final text = _messageController.text.trim();
    if (chat == null || text.isEmpty) return;

    _messageController.clear();
    setState(() {
      _isTyping = false;
    });

    try {
      await _api.sendMessage(chatId: chat.id, author: _userName, text: text);
      await _loadChats();
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Сообщение не отправлено. Backend недоступен.';
      });
    }
    _messageFocus.requestFocus();
  }

  void _toggleTyping(String value) {
    final hasText = value.trim().isNotEmpty;
    if (hasText == _isTyping) return;

    setState(() {
      _isTyping = hasText;
    });
  }

  Future<void> _reactTo(Message message, String reaction) async {
    try {
      await _api.setReaction(messageId: message.id, reaction: reaction);
      await _loadChats();
    } catch (_) {
      setState(() {
        message.reaction = message.reaction == reaction ? null : reaction;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!_isSignedIn) {
      return LoginScreen(
        isLoading: _isLoading,
        error: _error,
        onSignIn: _signInWithYandex,
      );
    }

    final selectedChat = _selectedChat;
    final isWide = MediaQuery.sizeOf(context).width >= 760;

    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            if (_error != null)
              MaterialBanner(
                content: Text(_error!),
                actions: [
                  TextButton(
                    onPressed: () => setState(() => _error = null),
                    child: const Text('Закрыть'),
                  ),
                ],
              ),
            Expanded(
              child: isWide
                  ? Row(
                      children: [
                        SizedBox(
                          width: 340,
                          child: _Sidebar(
                            chats: _chats,
                            selectedIndex: _selectedChatIndex,
                            userName: _userName,
                            nameController: _nameController,
                            onNameSaved: _saveName,
                            onChatSelected: _selectChat,
                          ),
                        ),
                        const VerticalDivider(width: 1),
                        Expanded(
                          child: selectedChat == null
                              ? const _EmptyState()
                              : _ChatView(
                                  chat: selectedChat,
                                  isTyping: _isTyping,
                                  messageController: _messageController,
                                  messageFocus: _messageFocus,
                                  onMessageChanged: _toggleTyping,
                                  onSend: _sendMessage,
                                  onReact: _reactTo,
                                ),
                        ),
                      ],
                    )
                  : Column(
                      children: [
                        SizedBox(
                          height: 210,
                          child: _Sidebar(
                            chats: _chats,
                            selectedIndex: _selectedChatIndex,
                            userName: _userName,
                            nameController: _nameController,
                            onNameSaved: _saveName,
                            onChatSelected: _selectChat,
                            compact: true,
                          ),
                        ),
                        const Divider(height: 1),
                        Expanded(
                          child: selectedChat == null
                              ? const _EmptyState()
                              : _ChatView(
                                  chat: selectedChat,
                                  isTyping: _isTyping,
                                  messageController: _messageController,
                                  messageFocus: _messageFocus,
                                  onMessageChanged: _toggleTyping,
                                  onSend: _sendMessage,
                                  onReact: _reactTo,
                                ),
                        ),
                      ],
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return const Center(child: Text('Чаты загружаются...'));
  }
}

class _Sidebar extends StatelessWidget {
  const _Sidebar({
    required this.chats,
    required this.selectedIndex,
    required this.userName,
    required this.nameController,
    required this.onNameSaved,
    required this.onChatSelected,
    this.compact = false,
  });

  final List<Chat> chats;
  final int selectedIndex;
  final String userName;
  final TextEditingController nameController;
  final VoidCallback onNameSaved;
  final ValueChanged<int> onChatSelected;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Theme.of(context).colorScheme.surface,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(
                  backgroundColor: Theme.of(context).colorScheme.primary,
                  foregroundColor: Theme.of(context).colorScheme.onPrimary,
                  child: Text(_initials(userName)),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextField(
                    controller: nameController,
                    onSubmitted: (_) => onNameSaved(),
                    decoration: const InputDecoration(
                      labelText: 'Ваше имя',
                      isDense: true,
                      border: OutlineInputBorder(),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton.filledTonal(
                  tooltip: 'Сохранить имя',
                  onPressed: onNameSaved,
                  icon: const Icon(Icons.check),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Text(
              'Чаты',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: ListView.separated(
                scrollDirection: compact ? Axis.horizontal : Axis.vertical,
                itemCount: chats.length,
                separatorBuilder: (_, __) => SizedBox(
                  width: compact ? 8 : 0,
                  height: compact ? 0 : 8,
                ),
                itemBuilder: (context, index) {
                  final chat = chats[index];
                  final selected = index == selectedIndex;
                  return SizedBox(
                    width: compact ? 260 : null,
                    child: _ChatTile(
                      chat: chat,
                      selected: selected,
                      onTap: () => onChatSelected(index),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ChatTile extends StatelessWidget {
  const _ChatTile({
    required this.chat,
    required this.selected,
    required this.onTap,
  });

  final Chat chat;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final lastMessage = chat.lastMessage;

    return InkWell(
      borderRadius: BorderRadius.circular(8),
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: selected ? colors.primaryContainer : colors.surface,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: selected ? colors.primary : colors.outlineVariant,
          ),
        ),
        child: Row(
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                CircleAvatar(child: Text(chat.avatarLabel)),
                if (chat.isOnline)
                  Positioned(
                    right: -1,
                    bottom: -1,
                    child: Container(
                      width: 12,
                      height: 12,
                      decoration: BoxDecoration(
                        color: Colors.green,
                        shape: BoxShape.circle,
                        border: Border.all(color: colors.surface, width: 2),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          chat.title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                      ),
                      if (lastMessage != null)
                        Text(
                          _timeLabel(lastMessage.sentAt),
                          style: Theme.of(context).textTheme.labelSmall,
                        ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    lastMessage?.text ?? 'Нет сообщений',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ChatView extends StatelessWidget {
  const _ChatView({
    required this.chat,
    required this.isTyping,
    required this.messageController,
    required this.messageFocus,
    required this.onMessageChanged,
    required this.onSend,
    required this.onReact,
  });

  final Chat chat;
  final bool isTyping;
  final TextEditingController messageController;
  final FocusNode messageFocus;
  final ValueChanged<String> onMessageChanged;
  final VoidCallback onSend;
  final void Function(Message message, String reaction) onReact;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;

    return Column(
      children: [
        Container(
          height: 72,
          padding: const EdgeInsets.symmetric(horizontal: 20),
          color: colors.surface,
          child: Row(
            children: [
              CircleAvatar(child: Text(chat.avatarLabel)),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      chat.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w800,
                          ),
                    ),
                    Text(
                      isTyping ? 'вы печатаете...' : chat.subtitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
              IconButton(
                tooltip: 'Обновить',
                onPressed: () {},
                icon: const Icon(Icons.sync),
              ),
            ],
          ),
        ),
        const Divider(height: 1),
        Expanded(
          child: ListView.builder(
            reverse: true,
            padding: const EdgeInsets.all(16),
            itemCount: chat.messages.length,
            itemBuilder: (context, index) {
              final message = chat.messages[chat.messages.length - 1 - index];
              return _MessageBubble(
                message: message,
                onReact: (reaction) => onReact(message, reaction),
              );
            },
          ),
        ),
        _Composer(
          controller: messageController,
          focusNode: messageFocus,
          onChanged: onMessageChanged,
          onSend: onSend,
        ),
      ],
    );
  }
}

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({
    required this.message,
    required this.onReact,
  });

  final Message message;
  final ValueChanged<String> onReact;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final alignment = message.isMine ? Alignment.centerRight : Alignment.centerLeft;
    final bubbleColor = message.isMine ? colors.primary : colors.surface;
    final textColor = message.isMine ? colors.onPrimary : colors.onSurface;

    return Align(
      alignment: alignment,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 520),
        child: Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Column(
            crossAxisAlignment:
                message.isMine ? CrossAxisAlignment.end : CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: bubbleColor,
                  borderRadius: BorderRadius.only(
                    topLeft: const Radius.circular(8),
                    topRight: const Radius.circular(8),
                    bottomLeft: Radius.circular(message.isMine ? 8 : 2),
                    bottomRight: Radius.circular(message.isMine ? 2 : 8),
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.06),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (!message.isMine)
                      Text(
                        message.author,
                        style: TextStyle(
                          color: textColor.withValues(alpha: 0.72),
                          fontWeight: FontWeight.w700,
                          fontSize: 12,
                        ),
                      ),
                    if (!message.isMine) const SizedBox(height: 4),
                    Text(
                      message.text,
                      style: TextStyle(color: textColor, fontSize: 15),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      _timeLabel(message.sentAt),
                      style: TextStyle(
                        color: textColor.withValues(alpha: 0.7),
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 4),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  for (final reaction in const ['👍', '❤️', '😂'])
                    Padding(
                      padding: const EdgeInsets.only(left: 4),
                      child: InkWell(
                        borderRadius: BorderRadius.circular(16),
                        onTap: () => onReact(reaction),
                        child: Container(
                          width: 34,
                          height: 28,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: message.reaction == reaction
                                ? colors.secondaryContainer
                                : colors.surface,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: colors.outlineVariant),
                          ),
                          child: Text(reaction),
                        ),
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Composer extends StatelessWidget {
  const _Composer({
    required this.controller,
    required this.focusNode,
    required this.onChanged,
    required this.onSend,
  });

  final TextEditingController controller;
  final FocusNode focusNode;
  final ValueChanged<String> onChanged;
  final VoidCallback onSend;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 16),
      color: colors.surface,
      child: SafeArea(
        top: false,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            IconButton.filledTonal(
              tooltip: 'Добавить файл',
              onPressed: () {},
              icon: const Icon(Icons.attach_file),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: TextField(
                controller: controller,
                focusNode: focusNode,
                minLines: 1,
                maxLines: 5,
                textInputAction: TextInputAction.send,
                onChanged: onChanged,
                onSubmitted: (_) => onSend(),
                decoration: const InputDecoration(
                  hintText: 'Сообщение',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.all(Radius.circular(8)),
                  ),
                  isDense: true,
                ),
              ),
            ),
            const SizedBox(width: 8),
            IconButton.filled(
              tooltip: 'Отправить',
              onPressed: onSend,
              icon: const Icon(Icons.send),
            ),
          ],
        ),
      ),
    );
  }
}

String _initials(String value) {
  final trimmed = value.trim();
  if (trimmed.isEmpty) return '?';
  return trimmed.substring(0, 1).toUpperCase();
}

String _timeLabel(DateTime date) {
  final hours = date.hour.toString().padLeft(2, '0');
  final minutes = date.minute.toString().padLeft(2, '0');
  return '$hours:$minutes';
}
