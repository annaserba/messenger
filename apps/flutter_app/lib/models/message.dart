class Message {
  Message({
    required this.id,
    required this.author,
    required this.text,
    required this.sentAt,
    required this.isMine,
    this.reaction,
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
      reaction: json['reaction'] as String?,
    );
  }

  final String id;
  final String author;
  final String text;
  final DateTime sentAt;
  final bool isMine;
  String? reaction;
}
