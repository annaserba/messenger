import 'message.dart';

enum ChatType { personal, group, channel }

class Chat {
  Chat({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.avatarLabel,
    required this.messages,
    required this.type,
    this.participantCount = 1,
    this.isOnline = false,
  });

  factory Chat.fromJson(Map<String, dynamic> json, String currentUser) {
    final messages = (json['messages'] as List<dynamic>? ?? [])
        .map((item) => Message.fromJson(item as Map<String, dynamic>, currentUser))
        .toList();

    final typeStr = json['type'] as String? ?? 'personal';
    final type = ChatType.values.firstWhere(
      (t) => t.name == typeStr,
      orElse: () => ChatType.personal,
    );

    final participants = json['participants'] as List<dynamic>? ?? [];

    return Chat(
      id: json['id'] as String,
      title: json['title'] as String,
      subtitle: json['subtitle'] as String? ?? '',
      avatarLabel: json['avatarLabel'] as String? ?? '?',
      isOnline: json['isOnline'] as bool? ?? false,
      type: type,
      participantCount: participants.length,
      messages: messages,
    );
  }

  final String id;
  final String title;
  final String subtitle;
  final String avatarLabel;
  final bool isOnline;
  final ChatType type;
  final int participantCount;
  final List<Message> messages;

  bool get isGroup => type == ChatType.group;
  bool get isChannel => type == ChatType.channel;

  Message? get lastMessage => messages.isEmpty ? null : messages.last;

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'subtitle': subtitle,
      'avatarLabel': avatarLabel,
      'isOnline': isOnline,
      'type': type.name,
      'messages': messages
          .map((message) => {
                'id': message.id,
                'author': message.author,
                'text': message.text,
                'sentAt': message.sentAt.toIso8601String(),
                'reaction': message.reaction,
              })
          .toList(),
    };
  }
}
