import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../domain/location_models.dart';
import '../domain/visit_models.dart';
import 'visit_notifier.dart';

class VisitDetailScreen extends ConsumerStatefulWidget {
  final String visitId;

  const VisitDetailScreen({super.key, required this.visitId});

  @override
  ConsumerState<VisitDetailScreen> createState() => _VisitDetailScreenState();
}

class _VisitDetailScreenState extends ConsumerState<VisitDetailScreen> {
  // Mock worker GPS location for testability and demonstration
  late GpsCoordinatesModel _currentCoords;

  @override
  void initState() {
    super.initState();
    // Default mock coordinate near SF Substation Alpha
    _currentCoords = GpsCoordinatesModel(
      latitude: 37.77492,
      longitude: -122.41938,
      accuracyMeters: 8.0,
      capturedAt: DateTime.now(),
    );
  }

  void _showExceptionDialog(
    BuildContext context,
    VisitModel visit,
    double distanceMeters,
  ) {
    final reasonController = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Outside Geofence Radius'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'You are ${distanceMeters.round()}m away from the authorized location '
              '(allowed: ${visit.location?.allowedRadiusMeters ?? 100}m).',
              style: const TextStyle(fontSize: 13),
            ),
            const SizedBox(height: 12),
            const Text(
              'A documented operational justification is required to check in outside the radius:',
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: reasonController,
              maxLines: 3,
              decoration: const InputDecoration(
                hintText: 'e.g. Security gate locked, meeting client at visitor lot...',
                border: OutlineInputBorder(),
                isDense: true,
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () async {
              final reason = reasonController.text.trim();
              if (reason.isEmpty) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Reason cannot be empty.')),
                );
                return;
              }
              Navigator.of(ctx).pop();
              await ref.read(visitNotifierProvider.notifier).checkIn(
                    widget.visitId,
                    coords: _currentCoords,
                    exceptionReason: reason,
                  );
            },
            child: const Text('Submit Override'),
          ),
        ],
      ),
    );
  }

  void _showCheckoutDialog(BuildContext context) {
    final notesController = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Record Check-Out'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'Record departure timestamp and optional notes on work completed.',
              style: TextStyle(fontSize: 13),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: notesController,
              maxLines: 3,
              decoration: const InputDecoration(
                hintText: 'Departure notes or handover details...',
                border: OutlineInputBorder(),
                isDense: true,
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.of(ctx).pop();
              await ref.read(visitNotifierProvider.notifier).checkOut(
                    widget.visitId,
                    coords: _currentCoords,
                    notes: notesController.text.trim(),
                  );
            },
            child: const Text('Confirm Departure'),
          ),
        ],
      ),
    );
  }

  void _showAddNoteProofDialog(BuildContext context) {
    final textController = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Add Field Note Proof'),
        content: TextField(
          controller: textController,
          maxLines: 4,
          decoration: const InputDecoration(
            hintText: 'Enter observation, meter reading, or work verification note...',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () async {
              final text = textController.text.trim();
              if (text.isEmpty) return;
              Navigator.of(ctx).pop();
              await ref.read(visitNotifierProvider.notifier).addProof(
                    widget.visitId,
                    type: ProofType.note,
                    notes: text,
                  );
            },
            child: const Text('Save Note'),
          ),
        ],
      ),
    );
  }

  void _showSignatureProofDialog(BuildContext context) {
    final signerController = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Customer Signature'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'Signer must confirm work completion on-site.',
              style: TextStyle(fontSize: 12),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: signerController,
              decoration: const InputDecoration(
                labelText: 'Signer Full Name',
                border: OutlineInputBorder(),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () async {
              final name = signerController.text.trim();
              if (name.isEmpty) return;
              Navigator.of(ctx).pop();
              await ref.read(visitNotifierProvider.notifier).addProof(
                    widget.visitId,
                    type: ProofType.signature,
                    signerName: name,
                    storagePath: 'signatures/${widget.visitId}_sig.png',
                  );
            },
            child: const Text('Record Signature'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(visitNotifierProvider);
    final matching = state.visits.where((v) => v.id == widget.visitId);

    if (matching.isEmpty) {
      return Scaffold(
        appBar: AppBar(title: const Text('Visit Details')),
        body: const Center(child: Text('Visit not found.')),
      );
    }

    final visit = matching.first;

    final location = visit.location;
    final distanceMeters = location != null
        ? GeofenceService.calculateDistanceMeters(
            _currentCoords.latitude,
            _currentCoords.longitude,
            location.latitude,
            location.longitude,
          )
        : null;

    final isWithinRadius = distanceMeters != null &&
        distanceMeters <= (location?.allowedRadiusMeters ?? 100);

    return Scaffold(
      appBar: AppBar(
        title: Text(location?.name ?? 'Visit Details'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Status and Site Card
            Card(
              elevation: 0.5,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: BorderSide(color: Colors.grey.shade200),
              ),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          location?.name ?? 'Operational Site',
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        _buildStatusChip(visit.status),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      location?.address ?? 'No address provided',
                      style: TextStyle(fontSize: 13, color: Colors.grey.shade600),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Icon(Icons.shield_outlined, size: 14, color: Colors.grey.shade500),
                        const SizedBox(width: 4),
                        Text(
                          'Authorized Radius: ${location?.allowedRadiusMeters ?? 100}m',
                          style: TextStyle(fontSize: 12, color: Colors.grey.shade700),
                        ),
                      ],
                    ),
                    if (location != null) ...[
                      const SizedBox(height: 12),
                      OutlinedButton.icon(
                        onPressed: () {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text(
                                'Navigating to ${location.name} via Google Maps (${location.latitude.toStringAsFixed(4)}, ${location.longitude.toStringAsFixed(4)})',
                              ),
                              duration: const Duration(seconds: 2),
                            ),
                          );
                        },
                        icon: const Icon(Icons.navigation_outlined, size: 16),
                        label: const Text(
                          'Navigate with Google Maps',
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                        ),
                        style: OutlinedButton.styleFrom(
                          minimumSize: const Size.fromHeight(36),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // GPS Check-In Action Section
            if (visit.status == VisitStatus.scheduled ||
                visit.status == VisitStatus.ready ||
                visit.status == VisitStatus.enRoute) ...[
              Card(
                color: isWithinRadius ? Colors.teal.shade50 : Colors.amber.shade50,
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                  side: BorderSide(
                    color: isWithinRadius ? Colors.teal.shade200 : Colors.amber.shade300,
                  ),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(
                            isWithinRadius ? Icons.check_circle : Icons.warning_amber,
                            color: isWithinRadius ? Colors.teal.shade700 : Colors.amber.shade800,
                          ),
                          const SizedBox(width: 8),
                          Text(
                            isWithinRadius ? 'Inside Authorized Radius' : 'Outside Authorized Radius',
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 14,
                              color: isWithinRadius ? Colors.teal.shade900 : Colors.amber.shade900,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text(
                        distanceMeters != null
                            ? 'Distance from target: ${distanceMeters.round()}m (Allowed: ${location?.allowedRadiusMeters ?? 100}m)'
                            : 'Acquiring GPS fix...',
                        style: TextStyle(
                          fontSize: 12,
                          color: isWithinRadius ? Colors.teal.shade800 : Colors.amber.shade900,
                        ),
                      ),
                      const SizedBox(height: 14),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton.icon(
                          onPressed: () {
                            if (isWithinRadius) {
                              ref.read(visitNotifierProvider.notifier).checkIn(
                                    visit.id,
                                    coords: _currentCoords,
                                  );
                            } else {
                              _showExceptionDialog(context, visit, distanceMeters ?? 0);
                            }
                          },
                          icon: const Icon(Icons.location_on),
                          label: Text(
                            isWithinRadius ? 'Check In (On-Site)' : 'Check In With Exception',
                          ),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: isWithinRadius ? Colors.teal.shade700 : Colors.amber.shade800,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 12),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
            ],

            // Check-In Stamp Card
            if (visit.checkin != null) ...[
              Card(
                elevation: 0.5,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                  side: BorderSide(color: Colors.grey.shade200),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Check-In Recorded',
                        style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Time: ${visit.checkin!.clientCapturedAt.toLocal()}',
                        style: const TextStyle(fontSize: 12),
                      ),
                      Text(
                        'Result: ${visit.checkin!.verificationResult.toDbCode()}',
                        style: const TextStyle(fontSize: 12),
                      ),
                      if (visit.checkin!.isException) ...[
                        const SizedBox(height: 4),
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: Colors.amber.shade50,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            'Exception: ${visit.checkin!.exceptionReason}',
                            style: TextStyle(fontSize: 11, color: Colors.amber.shade900),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
            ],

            // Proof of Work Section
            if (visit.status == VisitStatus.checkedIn ||
                visit.status == VisitStatus.inProgress ||
                visit.status == VisitStatus.checkedOut ||
                visit.status == VisitStatus.completed) ...[
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Proof of Work Evidence',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                  ),
                  if (visit.status != VisitStatus.completed &&
                      visit.status != VisitStatus.canceled)
                    PopupMenuButton<String>(
                      child: Chip(
                        label: const Text('+ Add Proof', style: TextStyle(fontSize: 11)),
                        backgroundColor: Colors.blue.shade50,
                      ),
                      onSelected: (val) {
                        if (val == 'photo') {
                          ref.read(visitNotifierProvider.notifier).addProof(
                                visit.id,
                                type: ProofType.photo,
                                storagePath: 'photos/${visit.id}_${DateTime.now().millisecondsSinceEpoch}.jpg',
                                fileName: 'job_evidence.jpg',
                              );
                        } else if (val == 'note') {
                          _showAddNoteProofDialog(context);
                        } else if (val == 'signature') {
                          _showSignatureProofDialog(context);
                        }
                      },
                      itemBuilder: (ctx) => [
                        const PopupMenuItem(value: 'photo', child: Text('Capture Photo')),
                        const PopupMenuItem(value: 'signature', child: Text('Customer Signature')),
                        const PopupMenuItem(value: 'note', child: Text('Field Note')),
                      ],
                    ),
                ],
              ),
              const SizedBox(height: 8),

              if (visit.proofs.isEmpty)
                Card(
                  elevation: 0,
                  color: Colors.grey.shade50,
                  child: const Padding(
                    padding: EdgeInsets.all(24),
                    child: Center(
                      child: Text(
                        'No proof submitted yet. Add photos, signatures, or notes before completion.',
                        style: TextStyle(fontSize: 12, color: Colors.grey),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ),
                )
              else
                ...visit.proofs.map(
                  (p) => Card(
                    margin: const EdgeInsets.only(bottom: 8),
                    child: ListTile(
                      dense: true,
                      leading: Icon(
                        p.proofType == ProofType.photo
                            ? Icons.camera_alt
                            : p.proofType == ProofType.signature
                                ? Icons.draw
                                : Icons.notes,
                        color: Colors.blueGrey,
                      ),
                      title: Text(
                        p.proofType.toDbCode(),
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                      subtitle: Text(
                        p.notes ?? p.signerName ?? p.fileName ?? 'Evidence stored',
                      ),
                      trailing: Text(
                        '${p.createdAt.hour}:${p.createdAt.minute.toString().padLeft(2, '0')}',
                        style: const TextStyle(fontSize: 10, color: Colors.grey),
                      ),
                    ),
                  ),
                ),
              const SizedBox(height: 16),
            ],

            // Check-Out / Departure Section
            if (visit.status == VisitStatus.checkedIn ||
                visit.status == VisitStatus.inProgress) ...[
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: () => _showCheckoutDialog(context),
                  icon: const Icon(Icons.exit_to_app),
                  label: const Text('Record Check-Out (Departure)'),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                ),
              ),
              const SizedBox(height: 16),
            ],

            // Mark Complete Section
            if (visit.status == VisitStatus.checkedOut) ...[
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () => ref.read(visitNotifierProvider.notifier).completeVisit(visit.id),
                  icon: const Icon(Icons.check_circle_outline),
                  label: const Text('Complete Field Visit'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.green.shade700,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildStatusChip(VisitStatus status) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: Colors.blue.shade50,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        status.toDbCode(),
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.bold,
          color: Colors.blue.shade700,
        ),
      ),
    );
  }
}
