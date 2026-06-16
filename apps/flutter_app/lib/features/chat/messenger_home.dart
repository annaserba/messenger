import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/storage/session_storage.dart';
import '../../core/ws/ws_client.dart';
import '../../models/chat.dart';
import '../../models/message.dart';
import '../../models/user.dart';
import '../auth/auth_redirect.dart';
import '../auth/login_screen.dart';

class MessengerHome extends StatefulWidget {
  const MessengerHome({super.key});

  @override
  State<MessengerHome> createState() => _MessengerHomeState();
}

class _MessengerHomeState extends State<MessengerHome> {
  final _api = ApiClient();
  final _messageController = TextEditingController();
  final _messageFocus = FocusNode();

  List<Chat> _chats = [];
  User? _user;
  int _selectedChatIndex = 0;
  bool _isTyping = false;
  bool _isSignedIn = false;
  bool _isLoading = false;
  String? _error;
  late final WsClient _ws;

  @override
  void initState() {
    super.initState();
    _ws = WsClient(baseUrl: _api.baseUrl);
    _consumeAuthRedirect();
  }

  @override
  void dispose() {
    _ws.disconnect();
    _messageController.dispose();
    _messageFocus.dispose();
    super.dispose();
  }

  String get _userName => _user?.name ?? '';

  Chat? get _selectedChat {
    if (_chats.isEmpty) return null;
    final safeIndex = _selectedChatIndex.clamp(0, _chats.length - 1);
    return _chats[safeIndex];
  }

  Future<void> _consumeAuthRedirect() async {
    final redirect = readAuthRedirect();
    if (redirect != null) {
      await _onTokenReceived(redirect.accessToken);
      return;
    }

    await _tryRestoreSession();
  }

  Future<void> _onTokenReceived(String token) async {
    _api.accessToken = token;

    try {
      final response = await _api.fetchMe();
      final userJson = response['user'] as Map<String, dynamic>;
      final user = User.fromJson(userJson);

      await _saveSession(token, userJson);

      if (!mounted) return;
      setState(() {
        _user = user;
        _isSignedIn = true;
        _error = null;
      });

      await _loadChats();
      _connectWs();
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Не удалось загрузить профиль. Попробуйте войти снова.';
        _api.accessToken = null;
      });
    }
  }

  Future<void> _tryRestoreSession() async {
    final stored = await loadSession();
    if (stored == null) return;

    final token = stored['accessToken'] as String?;
    if (token == null || token.isEmpty) return;

    _api.accessToken = token;

    try {
      final response = await _api.fetchMe();
      final userJson = response['user'] as Map<String, dynamic>;
      final user = User.fromJson(userJson);

      if (!mounted) return;
      setState(() {
        _user = user;
        _isSignedIn = true;
        _error = null;
      });

      await _loadChats();
      _connectWs();
    } catch (_) {
      await clearSession();
      if (!mounted) return;
      setState(() {
        _api.accessToken = null;
      });
    }
  }

  Future<void> _saveSession(String token, Map<String, dynamic> user) async {
    await saveSession({
      'accessToken': token,
      'user': user,
    });
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
      final userJson = response['user'] as Map<String, dynamic>;
      final user = User.fromJson(userJson);
      final token = response['accessToken'] as String?;

      _api.accessToken = token;
      await _saveSession(token ?? '', userJson);

      if (!mounted) return;
      setState(() {
        _user = user;
        _isSignedIn = true;
      });

      await _loadChats();
      _connectWs();
    } catch (_) {
      if (!mounted) return;
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

  Future<void> _connectWs() async {
    final token = _api.accessToken;
    if (token == null) return;
    await _ws.connect(token: token, onEvent: _onWsEvent);
  }

  void _onWsEvent(Map<String, dynamic> event) {
    final type = event['type'] as String?;
    if (type == 'message' || type == 'reaction') {
      _loadChats();
    }
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
      await _api.sendMessage(chatId: chat.id, text: text);
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
    } catch (_) {}
  }

  void _showReactionPicker(Message message) {
    showModalBottomSheet(
      context: context,
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Wrap(
              spacing: 12,
              runSpacing: 12,
              children: [
                for (final emoji in const ['👍', '❤️', '😂', '😮', '😢', '🙏', '👏', '🔥', '🎉', '💯'])
                  InkWell(
                    borderRadius: BorderRadius.circular(12),
                    onTap: () {
                      Navigator.pop(ctx);
                      _reactTo(message, emoji);
                    },
                    child: Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: Theme.of(ctx).colorScheme.surfaceContainerHighest,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(emoji, style: const TextStyle(fontSize: 24)),
                    ),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }

  void _quickReact(Message message) {
    _reactTo(message, '👍');
  }

  Future<void> _logout() async {
    _ws.disconnect();
    await clearSession();
    if (!mounted) return;
    setState(() {
      _api.accessToken = null;
      _user = null;
      _isSignedIn = false;
      _chats = [];
      _error = null;
    });
  }

  Future<void> _createChat(String title, String type) async {
    try {
      await _api.createChat(title: title, type: type);
      await _loadChats();
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Не удалось создать чат.';
      });
    }
  }

  void _showCreateChatDialog() {
    final nameCtrl = TextEditingController();
    String chatType = 'group';

    showDialog(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setDialogState) {
            return AlertDialog(
              title: const Text('Новый чат'),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(
                    controller: nameCtrl,
                    autofocus: true,
                    decoration: const InputDecoration(
                      labelText: 'Название',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 16),
                  SegmentedButton<String>(
                    segments: const [
                      ButtonSegment(value: 'group', label: Text('Группа'), icon: Icon(Icons.group)),
                      ButtonSegment(value: 'channel', label: Text('Канал'), icon: Icon(Icons.campaign)),
                    ],
                    selected: {chatType},
                    onSelectionChanged: (v) => setDialogState(() => chatType = v.first),
                  ),
                ],
              ),
              actions: [
                TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Отмена')),
                FilledButton(
                  onPressed: () {
                    final name = nameCtrl.text.trim();
                    if (name.isEmpty) return;
                    Navigator.pop(ctx);
                    _createChat(name, chatType);
                  },
                  child: const Text('Создать'),
                ),
              ],
            );
          },
        );
      },
    );
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
                            user: _user,
                            onChatSelected: _selectChat,
                            onLogout: _logout,
                            onCreateChat: _showCreateChatDialog,
                          ),
                        ),
                        const VerticalDivider(width: 1),
                        Expanded(
                          child: selectedChat == null
                              ? const _EmptyState()
                              : _ChatView(
                                  chat: selectedChat,
                                  avatarUrl: _user?.avatarUrl,
                                  isTyping: _isTyping,
                                  messageController: _messageController,
                                  messageFocus: _messageFocus,
                                  onMessageChanged: _toggleTyping,
                                  onSend: _sendMessage,
                                  onLongPress: _showReactionPicker,
                                  onDoubleTap: _quickReact,
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
                            user: _user,
                            onChatSelected: _selectChat,
                            onLogout: _logout,
                            onCreateChat: _showCreateChatDialog,
                            compact: true,
                          ),
                        ),
                        const Divider(height: 1),
                        Expanded(
                          child: selectedChat == null
                              ? const _EmptyState()
                              : _ChatView(
                                  chat: selectedChat,
                                  avatarUrl: _user?.avatarUrl,
                                  isTyping: _isTyping,
                                  messageController: _messageController,
                                  messageFocus: _messageFocus,
                                  onMessageChanged: _toggleTyping,
                                  onSend: _sendMessage,
                                  onLongPress: _showReactionPicker,
                                  onDoubleTap: _quickReact,
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
    required this.user,
    required this.onChatSelected,
    required this.onLogout,
    required this.onCreateChat,
    this.compact = false,
  });

  final List<Chat> chats;
  final int selectedIndex;
  final User? user;
  final ValueChanged<int> onChatSelected;
  final VoidCallback onLogout;
  final VoidCallback onCreateChat;
  final bool compact;

  String? _avatarForChat(Chat chat) {
    if (!chat.isGroup && !chat.isChannel && chat.id == user?.id) {
      return user?.avatarUrl;
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;

    return Material(
      color: colors.surface,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                _UserAvatar(
                  avatarUrl: user?.avatarUrl,
                  name: user?.name ?? '',
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        user?.name ?? '',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context)
                            .textTheme
                            .titleMedium
                            ?.copyWith(fontWeight: FontWeight.w700),
                      ),
                      if (user?.email != null) ...[
                        const SizedBox(height: 2),
                        Text(
                          user!.email!,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context)
                              .textTheme
                              .labelSmall
                              ?.copyWith(color: colors.onSurfaceVariant),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(width: 4),
                IconButton(
                  tooltip: 'Выйти',
                  onPressed: onLogout,
                  icon: Icon(Icons.logout, color: colors.error),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Чаты',
                    style: Theme.of(context)
                        .textTheme
                        .titleMedium
                        ?.copyWith(fontWeight: FontWeight.w700),
                  ),
                ),
                IconButton.filledTonal(
                  tooltip: 'Создать чат',
                  onPressed: onCreateChat,
                  icon: const Icon(Icons.add, size: 20),
                  visualDensity: VisualDensity.compact,
                ),
              ],
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
                      avatarUrl: _avatarForChat(chat),
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

class _UserAvatar extends StatelessWidget {
  const _UserAvatar({this.avatarUrl, required this.name});

  final String? avatarUrl;
  final String name;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;

    if (avatarUrl != null && avatarUrl!.isNotEmpty) {
      return CircleAvatar(
        radius: 20,
        backgroundColor: colors.surfaceContainerHighest,
        backgroundImage: NetworkImage(avatarUrl!),
        onBackgroundImageError: (_, __) {},
      );
    }

    return CircleAvatar(
      radius: 20,
      backgroundColor: colors.primary,
    );
  }
}

class _ChatTile extends StatelessWidget {
  const _ChatTile({
    required this.chat,
    required this.selected,
    required this.onTap,
    this.avatarUrl,
  });

  final Chat chat;
  final bool selected;
  final VoidCallback onTap;
  final String? avatarUrl;

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
                CircleAvatar(
                  backgroundColor: chat.isChannel
                      ? colors.tertiary
                      : chat.isGroup
                          ? colors.secondary
                          : null,
                  backgroundImage: avatarUrl != null && avatarUrl!.isNotEmpty
                      ? NetworkImage(avatarUrl!)
                      : null,
                  onBackgroundImageError: avatarUrl != null ? (_, __) {} : null,
                  child: avatarUrl == null || avatarUrl!.isEmpty
                      ? (chat.isChannel
                          ? const Icon(Icons.campaign, size: 18)
                          : chat.isGroup
                              ? const Icon(Icons.group, size: 18)
                              : Text(chat.avatarLabel))
                      : null,
                ),
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
                    chat.isChannel
                        ? 'канал · ${chat.participantCount} подписчиков'
                        : chat.isGroup
                            ? '${chat.participantCount} участников'
                            : lastMessage?.text ?? 'Нет сообщений',
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
    this.avatarUrl,
    required this.isTyping,
    required this.messageController,
    required this.messageFocus,
    required this.onMessageChanged,
    required this.onSend,
    required this.onLongPress,
    required this.onDoubleTap,
  });

  final Chat chat;
  final String? avatarUrl;
  final bool isTyping;
  final TextEditingController messageController;
  final FocusNode messageFocus;
  final ValueChanged<String> onMessageChanged;
  final VoidCallback onSend;
  final void Function(Message message) onLongPress;
  final void Function(Message message) onDoubleTap;

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
              CircleAvatar(
                backgroundColor: chat.isChannel
                    ? colors.tertiary
                    : chat.isGroup
                        ? colors.secondary
                        : null,
                backgroundImage: !chat.isGroup && !chat.isChannel && avatarUrl != null && avatarUrl!.isNotEmpty
                    ? NetworkImage(avatarUrl!)
                    : null,
                onBackgroundImageError: avatarUrl != null ? (_, __) {} : null,
                child: (chat.isGroup || chat.isChannel || avatarUrl == null || avatarUrl!.isEmpty)
                    ? (chat.isChannel
                        ? const Icon(Icons.campaign, size: 18)
                        : chat.isGroup
                            ? const Icon(Icons.group, size: 18)
                            : Text(chat.avatarLabel))
                    : null,
              ),
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
                      style: Theme.of(context)
                          .textTheme
                          .titleMedium
                          ?.copyWith(fontWeight: FontWeight.w800),
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
                onLongPress: () => onLongPress(message),
                onDoubleTap: () => onDoubleTap(message),
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
    required this.onLongPress,
    required this.onDoubleTap,
  });

  final Message message;
  final VoidCallback onLongPress;
  final VoidCallback onDoubleTap;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final alignment =
        message.isMine ? Alignment.centerRight : Alignment.centerLeft;
    final bubbleColor = message.isMine ? colors.primary : colors.surface;
    final textColor = message.isMine ? colors.onPrimary : colors.onSurface;

    return Align(
      alignment: alignment,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 520),
        child: Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: GestureDetector(
            onLongPress: onLongPress,
            onDoubleTap: onDoubleTap,
            child: Column(
              crossAxisAlignment: message.isMine
                  ? CrossAxisAlignment.end
                  : CrossAxisAlignment.start,
              children: [
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
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
                        color: Colors.black.withOpacity(0.06),
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
                            color: textColor.withOpacity(0.72),
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
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            _timeLabel(message.sentAt),
                            style: TextStyle(
                              color: textColor.withOpacity(0.7),
                              fontSize: 11,
                            ),
                          ),
                          if (message.hasReactions) ...[
                            const SizedBox(width: 8),
                            ...message.reactions.map((r) => Padding(
                                  padding: const EdgeInsets.only(left: 4),
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: r.mine
                                          ? colors.primaryContainer
                                          : colors.surfaceContainerHighest,
                                      borderRadius: BorderRadius.circular(10),
                                    ),
                                    child: Text(
                                      '${r.emoji} ${r.count}',
                                      style: const TextStyle(fontSize: 12),
                                    ),
                                  ),
                                )),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
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

String _timeLabel(DateTime date) {
  final hours = date.hour.toString().padLeft(2, '0');
  final minutes = date.minute.toString().padLeft(2, '0');
  return '$hours:$minutes';
}
