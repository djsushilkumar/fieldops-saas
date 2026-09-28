import 'dart:convert';
import 'package:flutter/foundation.dart';

enum MutationSyncStatus {
  pending,
  syncing,
  synced,
  conflict,
  failed;

  static MutationSyncStatus fromString(String val) {
    switch (val.toUpperCase()) {
      case 'SYNCING':
        return MutationSyncStatus.syncing;
      case 'SYNCED':
        return MutationSyncStatus.synced;
      case 'CONFLICT':
        return MutationSyncStatus.conflict;
      case 'FAILED':
        return MutationSyncStatus.failed;
      case 'PENDING':
      default:
        return MutationSyncStatus.pending;
    }
  }

  String toDbCode() {
    switch (this) {
      case MutationSyncStatus.syncing:
        return 'SYNCING';
      case MutationSyncStatus.synced:
        return 'SYNCED';
      case MutationSyncStatus.conflict:
        return 'CONFLICT';
      case MutationSyncStatus.failed:
        return 'FAILED';
      case MutationSyncStatus.pending:
        return 'PENDING';
    }
  }
}

@immutable
class OfflineMutationEntry {
  final String mutationId;
  final String idempotencyKey;
  final String tenantId;
  final String userId;
  final String entityType;
  final String entityId;
  final String action;
  final Map<String, dynamic> payload;
  final DateTime clientTimestamp;
  final int retryCount;
  final MutationSyncStatus status;
  final String? conflictReason;

  const OfflineMutationEntry({
    required this.mutationId,
    required this.idempotencyKey,
    required this.tenantId,
    required this.userId,
    required this.entityType,
    required this.entityId,
    required this.action,
    required this.payload,
    required this.clientTimestamp,
    this.retryCount = 0,
    this.status = MutationSyncStatus.pending,
    this.conflictReason,
  });

  OfflineMutationEntry copyWith({
    String? mutationId,
    String? idempotencyKey,
    String? tenantId,
    String? userId,
    String? entityType,
    String? entityId,
    String? action,
    Map<String, dynamic>? payload,
    DateTime? clientTimestamp,
    int? retryCount,
    MutationSyncStatus? status,
    String? conflictReason,
  }) {
    return OfflineMutationEntry(
      mutationId: mutationId ?? this.mutationId,
      idempotencyKey: idempotencyKey ?? this.idempotencyKey,
      tenantId: tenantId ?? this.tenantId,
      userId: userId ?? this.userId,
      entityType: entityType ?? this.entityType,
      entityId: entityId ?? this.entityId,
      action: action ?? this.action,
      payload: payload ?? this.payload,
      clientTimestamp: clientTimestamp ?? this.clientTimestamp,
      retryCount: retryCount ?? this.retryCount,
      status: status ?? this.status,
      conflictReason: conflictReason ?? this.conflictReason,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'mutationId': mutationId,
      'idempotencyKey': idempotencyKey,
      'tenantId': tenantId,
      'userId': userId,
      'entityType': entityType,
      'entityId': entityId,
      'action': action,
      'payload': payload,
      'clientTimestamp': clientTimestamp.toIso8601String(),
      'retryCount': retryCount,
      'status': status.toDbCode(),
      'conflictReason': conflictReason,
    };
  }

  factory OfflineMutationEntry.fromJson(Map<String, dynamic> json) {
    final rawPayload = json['payload'];
    final Map<String, dynamic> parsedPayload = rawPayload is String
        ? jsonDecode(rawPayload) as Map<String, dynamic>
        : (rawPayload as Map<String, dynamic>? ?? {});

    return OfflineMutationEntry(
      mutationId: json['mutationId'] as String,
      idempotencyKey: json['idempotencyKey'] as String,
      tenantId: json['tenantId'] as String,
      userId: json['userId'] as String,
      entityType: json['entityType'] as String,
      entityId: json['entityId'] as String,
      action: json['action'] as String,
      payload: parsedPayload,
      clientTimestamp: DateTime.parse(json['clientTimestamp'] as String),
      retryCount: (json['retryCount'] as num?)?.toInt() ?? 0,
      status: MutationSyncStatus.fromString((json['status'] ?? 'PENDING') as String),
      conflictReason: json['conflictReason'] as String?,
    );
  }
}

class OfflineMutationQueue {
  final List<OfflineMutationEntry> _inMemoryQueue = [];

  List<OfflineMutationEntry> get queue => List.unmodifiable(_inMemoryQueue);

  int get pendingCount =>
      _inMemoryQueue.where((m) => m.status == MutationSyncStatus.pending).length;

  Future<OfflineMutationEntry> enqueue({
    required String tenantId,
    required String userId,
    required String entityType,
    required String entityId,
    required String action,
    required Map<String, dynamic> payload,
  }) async {
    final now = DateTime.now().toUtc();
    final mutationId = 'mut_${now.millisecondsSinceEpoch}_${_inMemoryQueue.length + 1}';
    final idempotencyKey = 'idem_${userId}_${entityId}_${action}_${now.millisecondsSinceEpoch}';

    final entry = OfflineMutationEntry(
      mutationId: mutationId,
      idempotencyKey: idempotencyKey,
      tenantId: tenantId,
      userId: userId,
      entityType: entityType,
      entityId: entityId,
      action: action,
      payload: payload,
      clientTimestamp: now,
      retryCount: 0,
      status: MutationSyncStatus.pending,
    );

    _inMemoryQueue.add(entry);
    return entry;
  }

  List<OfflineMutationEntry> getPendingMutations() {
    return _inMemoryQueue
        .where((m) => m.status == MutationSyncStatus.pending)
        .toList();
  }

  void markSyncing(String mutationId) {
    final idx = _inMemoryQueue.indexWhere((m) => m.mutationId == mutationId);
    if (idx != -1) {
      _inMemoryQueue[idx] = _inMemoryQueue[idx].copyWith(status: MutationSyncStatus.syncing);
    }
  }

  void markSynced(String mutationId) {
    final idx = _inMemoryQueue.indexWhere((m) => m.mutationId == mutationId);
    if (idx != -1) {
      _inMemoryQueue[idx] = _inMemoryQueue[idx].copyWith(status: MutationSyncStatus.synced);
    }
  }

  void markConflict(String mutationId, String reason) {
    final idx = _inMemoryQueue.indexWhere((m) => m.mutationId == mutationId);
    if (idx != -1) {
      _inMemoryQueue[idx] = _inMemoryQueue[idx].copyWith(
        status: MutationSyncStatus.conflict,
        conflictReason: reason,
      );
    }
  }

  void markFailed(String mutationId, String reason) {
    final idx = _inMemoryQueue.indexWhere((m) => m.mutationId == mutationId);
    if (idx != -1) {
      final current = _inMemoryQueue[idx];
      _inMemoryQueue[idx] = current.copyWith(
        status: MutationSyncStatus.failed,
        retryCount: current.retryCount + 1,
        conflictReason: reason,
      );
    }
  }

  void clearSynced() {
    _inMemoryQueue.removeWhere((m) => m.status == MutationSyncStatus.synced);
  }
}
