class User {
  User({
    required this.id,
    required this.name,
    this.email,
    this.avatarUrl,
    this.firstName,
    this.lastName,
    required this.provider,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] as String,
      name: json['name'] as String? ?? 'Пользователь',
      email: json['email'] as String?,
      avatarUrl: json['avatarUrl'] as String?,
      firstName: json['firstName'] as String?,
      lastName: json['lastName'] as String?,
      provider: json['provider'] as String? ?? 'unknown',
    );
  }

  final String id;
  final String name;
  final String? email;
  final String? avatarUrl;
  final String? firstName;
  final String? lastName;
  final String provider;

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'email': email,
      'avatarUrl': avatarUrl,
      'firstName': firstName,
      'lastName': lastName,
      'provider': provider,
    };
  }
}
