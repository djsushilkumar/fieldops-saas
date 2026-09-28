import 'package:flutter_test/flutter_test.dart';
import 'package:fieldops_mobile/features/sync/offline_mutation_queue.dart';

void main() {
  group('OfflineMutationQueue in Dart', () {
    test('enqueues mutations with unique mutationId and idempotencyKey', () async {
      final queue = OfflineMutationQueue();

      final m1 = await queue.enqueue(
        tenantId: 'ten_01',
        userId: 'usr_01',
        entityType: 'task',
        entityId: 'tsk_101',
        action: 'transition_status',
        payload: {'status': 'IN_PROGRESS'},
      );

      final m2 = await queue.enqueue(
        tenantId: 'ten_01',
        userId: 'usr_01',
        entityType: 'checklist',
        entityId: 'chk_1',
        action: 'toggle_checklist',
        payload: {'isCompleted': true},
      );

      expect(m1.mutationId, isNotEmpty);
      expect(m2.mutationId, isNotEmpty);
      expect(m1.mutationId, isNot(equals(m2.mutationId)));

      expect(m1.idempotencyKey, isNotEmpty);
      expect(m2.idempotencyKey, isNotEmpty);
      expect(m1.idempotencyKey, isNot(equals(m2.idempotencyKey)));

      expect(queue.pendingCount, 2);
      expect(queue.getPendingMutations().length, 2);
    });

    test('updates status through syncing, synced, and conflict', () async {
      final queue = OfflineMutationQueue();

      final m = await queue.enqueue(
        tenantId: 'ten_01',
        userId: 'usr_01',
        entityType: 'task',
        entityId: 'tsk_101',
        action: 'transition_status',
        payload: {'status': 'IN_PROGRESS'},
      );

      queue.markSyncing(m.mutationId);
      expect(queue.queue.first.status, MutationSyncStatus.syncing);

      queue.markSynced(m.mutationId);
      expect(queue.queue.first.status, MutationSyncStatus.synced);
      expect(queue.pendingCount, 0);

      queue.clearSynced();
      expect(queue.queue.isEmpty, true);
    });

    test('marks conflict and failed statuses with error reasons', () async {
      final queue = OfflineMutationQueue();

      final m = await queue.enqueue(
        tenantId: 'ten_01',
        userId: 'usr_01',
        entityType: 'task',
        entityId: 'tsk_101',
        action: 'transition_status',
        payload: {'status': 'IN_PROGRESS'},
      );

      queue.markConflict(m.mutationId, 'Server version 3 > Client version 2');
      expect(queue.queue.first.status, MutationSyncStatus.conflict);
      expect(queue.queue.first.conflictReason, contains('Server version 3'));

      queue.markFailed(m.mutationId, 'HTTP 500 timeout');
      expect(queue.queue.first.status, MutationSyncStatus.failed);
      expect(queue.queue.first.retryCount, 1);
    });
  });
}
