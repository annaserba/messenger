import 'message.dart';

class Chat {
  Chat({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.avatarLabel,
    required this.messages,
    this.isOnline = false,
    this.isGroup = false,
  });

  factory Chat.fromJson(Map<String, dynamic> json, String currentUser) {
    final messages = (json['messages'] as List<dynamic>? ?? [])
        .map((item) => Message.fromJson(item as Map<String, dynamic>, currentUser))
        .toList();

    return Chat(
      id: json['id'] as String,
      title: json['title'] as String,
      subtitle: json['subtitle'] as String? ?? '',
      avatarLabel: json['avatarLabel'] as String? ?? '?',
      isOnline: json['isOnline'] as bool? ?? false,
      isGroup: json['isGroup'] as bool? ?? false,
      messages: messages,
    );
  }

  final String id;
  final String title;
  final String subtitle;
  final String avatarLabel;
  final bool isOnline;
  final bool isGroup;
  final List<Message> messages;

  Message? get lastMessage => messages.isEmpty ? null : messages.last;

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'subtitle': subtitle,
      'avatarLabel': avatarLabel,
      'isOnline': isOnline,
      'isGroup': isGroup,
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
