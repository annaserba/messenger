class ReplyInfo {
  const ReplyInfo({required this.id, required this.author, required this.text});

  factory ReplyInfo.fromJson(Map<String, dynamic> json) {
    return ReplyInfo(
      id: json['id'] as String,
      author: json['author'] as String? ?? '',
      text: json['text'] as String? ?? '',
    );
  }

  final String id;
  final String author;
  final String text;
}

class Message {
  Message({
    required this.id,
    required this.author,
    required this.text,
    required this.sentAt,
    required this.isMine,
    this.reactions = const [],
    this.replyTo,
  });

  factory Message.fromJson(Map<String, dynamic> json, String currentUser) {
    final author = json['author'] as String? ?? 'Пользователь';
    return Message(
      id: json['id'] as String,
      author: author,
      text: json['text'] as String? ?? '',
      sentAt:
          DateTime.tryParse(json['sentAt'] as String? ?? '') ?? DateTime.now(),
      isMine: author == currentUser,
      reactions: _parseReactions(json['reactions'] as List<dynamic>?, currentUser),
      replyTo: json['replyTo'] != null
          ? ReplyInfo.fromJson(json['replyTo'] as Map<String, dynamic>)
          : null,
    );
  }

  static List<MessageReaction> _parseReactions(List<dynamic>? raw, String currentUser) {
    if (raw == null || raw.isEmpty) return [];
    final counts = <String, int>{};
    final userEmojis = <String, String>{};
    for (final r in raw) {
      if (r is Map<String, dynamic>) {
        final emoji = r['emoji'] as String? ?? '';
        final uid = r['userId'] as String? ?? '';
        if (emoji.isNotEmpty) {
          counts[emoji] = (counts[emoji] ?? 0) + 1;
          if (uid == currentUser) userEmojis[emoji] = emoji;
        }
      }
    }
    return counts.entries.map((e) {
      return MessageReaction(
        emoji: e.key,
        count: e.value,
        mine: userEmojis.containsKey(e.key),
        userId: userEmojis[e.key] ?? '',
      );
    }).toList();
  }

  final String id;
  final String author;
  final String text;
  final DateTime sentAt;
  final bool isMine;
  final List<MessageReaction> reactions;
  final ReplyInfo? replyTo;

  bool get hasReactions => reactions.isNotEmpty;
}

class MessageReaction {
  const MessageReaction({
    required this.emoji,
    required this.count,
    required this.mine,
    required this.userId,
  });

  final String emoji;
  final int count;
  final bool mine;
  final String userId;
}
