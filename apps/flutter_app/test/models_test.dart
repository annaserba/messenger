import 'package:flutter_test/flutter_test.dart';
import 'package:messenger/models/chat.dart';
import 'package:messenger/models/message.dart';
import 'package:messenger/models/user.dart';

void main() {
  group('User', () {
    test('fromJson parses Yandex profile', () {
      final user = User.fromJson({
        'id': '12345',
        'name': 'Иван',
        'email': 'ivan@example.com',
        'avatarUrl': 'https://avatars.yandex.net/get-yapic/123/islands-200',
        'firstName': 'Иван',
        'lastName': 'Петров',
        'provider': 'yandex',
      });

      expect(user.id, '12345');
      expect(user.name, 'Иван');
      expect(user.email, 'ivan@example.com');
      expect(user.avatarUrl, contains('avatars.yandex.net'));
      expect(user.firstName, 'Иван');
      expect(user.lastName, 'Петров');
      expect(user.provider, 'yandex');
    });

    test('toJson round-trips', () {
      final user = User(
        id: '1',
        name: 'Анна',
        email: 'a@b.com',
        provider: 'yandex-demo',
      );
      final json = user.toJson();
      final restored = User.fromJson(json);
      expect(restored.id, '1');
      expect(restored.name, 'Анна');
      expect(restored.email, 'a@b.com');
    });
  });

  group('Message', () {
    test('fromJson parses without reactions', () {
      final msg = Message.fromJson({
        'id': 'm1',
        'author': 'Анна',
        'text': 'Привет',
        'sentAt': '2026-06-17T12:00:00.000Z',
        'reactions': [],
      }, 'Анна');

      expect(msg.id, 'm1');
      expect(msg.author, 'Анна');
      expect(msg.text, 'Привет');
      expect(msg.isMine, true);
      expect(msg.reactions, isEmpty);
    });

    test('fromJson aggregates reactions', () {
      final msg = Message.fromJson({
        'id': 'm2',
        'author': 'Боб',
        'text': 'Тест',
        'sentAt': '2026-06-17T12:00:00.000Z',
        'reactions': [
          {'userId': 'u1', 'emoji': '👍', 'name': 'Анна'},
          {'userId': 'u2', 'emoji': '👍', 'name': 'Боб'},
          {'userId': 'u1', 'emoji': '❤️', 'name': 'Анна'},
        ],
      }, 'u1');

      expect(msg.reactions.length, 2);
      final thumbsUp = msg.reactions.firstWhere((r) => r.emoji == '👍');
      expect(thumbsUp.count, 2);
      expect(thumbsUp.mine, true);
    });

    test('fromJson null reactions', () {
      final msg = Message.fromJson({
        'id': 'm3',
        'author': 'Анна',
        'text': 'Ок',
        'sentAt': '2026-06-17T12:00:00.000Z',
      }, 'Анна');

      expect(msg.reactions, isEmpty);
    });
  });

  group('Chat', () {
    test('fromJson personal chat', () {
      final chat = Chat.fromJson({
        'id': 'c1',
        'title': 'Анна',
        'type': 'personal',
        'avatarLabel': 'А',
        'isOnline': true,
        'participants': [{'userId': 'u1', 'name': 'Анна', 'role': 'admin'}],
        'messages': [],
      }, 'Анна');

      expect(chat.id, 'c1');
      expect(chat.type, ChatType.personal);
      expect(chat.isGroup, false);
      expect(chat.isChannel, false);
    });

    test('fromJson group chat', () {
      final chat = Chat.fromJson({
        'id': 'g1',
        'title': 'Команда',
        'type': 'group',
        'avatarLabel': 'К',
        'participants': [
          {'userId': 'u1', 'name': 'A', 'role': 'admin'},
          {'userId': 'u2', 'name': 'B', 'role': 'member'},
          {'userId': 'u3', 'name': 'C', 'role': 'member'},
        ],
        'messages': [],
      }, 'Анна');

      expect(chat.type, ChatType.group);
      expect(chat.isGroup, true);
      expect(chat.participantCount, 3);
    });

    test('fromJson channel', () {
      final chat = Chat.fromJson({
        'id': 'ch1',
        'title': 'Новости',
        'type': 'channel',
        'avatarLabel': 'Н',
        'participants': [{'userId': 'u1', 'name': 'A', 'role': 'admin'}],
        'messages': [],
      }, 'Анна');

      expect(chat.type, ChatType.channel);
      expect(chat.isChannel, true);
    });
  });
}
