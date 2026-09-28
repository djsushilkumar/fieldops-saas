import 'package:flutter/foundation.dart';
import 'location_models.dart';

enum VisitStatus {
  scheduled,
  ready,
  enRoute,
  checkedIn,
  inProgress,
  checkedOut,
  completed,
  canceled,
  missed;

  static VisitStatus fromString(String val) {
    switch (val.toUpperCase()) {
      case 'READY':
        return VisitStatus.ready;
      case 'EN_ROUTE':
        return VisitStatus.enRoute;
      case 'CHECKED_IN':
        return VisitStatus.checkedIn;
      case 'IN_PROGRESS':
        return VisitStatus.inProgress;
      case 'CHECKED_OUT':
        return VisitStatus.checkedOut;
      case 'COMPLETED':
        return VisitStatus.completed;
      case 'CANCELED':
        return VisitStatus.canceled;
      case 'MISSED':
        return VisitStatus.missed;
      case 'SCHEDULED':
      default:
        return VisitStatus.scheduled;
    }
  }

  String toDbCode() {
    switch (this) {
      case VisitStatus.scheduled:
        return 'SCHEDULED';
      case VisitStatus.ready:
        return 'READY';
      case VisitStatus.enRoute:
        return 'EN_ROUTE';
      case VisitStatus.checkedIn:
        return 'CHECKED_IN';
      case VisitStatus.inProgress:
        return 'IN_PROGRESS';
      case VisitStatus.checkedOut:
        return 'CHECKED_OUT';
      case VisitStatus.completed:
        return 'COMPLETED';
      case VisitStatus.canceled:
        return 'CANCELED';
      case VisitStatus.missed:
        return 'MISSED';
    }
  }
}

enum ProofType {
  photo,
  note,
  signature,
  checklist;

  static ProofType fromString(String val) {
    switch (val.toUpperCase()) {
      case 'NOTE':
        return ProofType.note;
      case 'SIGNATURE':
        return ProofType.signature;
      case 'CHECKLIST':
        return ProofType.checklist;
      case 'PHOTO':
      default:
        return ProofType.photo;
    }
  }

  String toDbCode() {
    switch (this) {
      case ProofType.photo:
        return 'PHOTO';
      case ProofType.note:
        return 'NOTE';
      case ProofType.signature:
        return 'SIGNATURE';
      case ProofType.checklist:
        return 'CHECKLIST';
    }
  }
}

@immutable
class VisitCheckinModel {
  final String id;
  final String visitId;
  final String workerId;
  final double latitude;
  final double longitude;
  final double accuracyMeters;
  final double distanceMeters;
  final LocationVerificationResult verificationResult;
  final bool isException;
  final String? exceptionReason;
  final DateTime clientCapturedAt;

  const VisitCheckinModel({
    required this.id,
    required this.visitId,
    required this.workerId,
    required this.latitude,
    required this.longitude,
    required this.accuracyMeters,
    required this.distanceMeters,
    required this.verificationResult,
    this.isException = false,
    this.exceptionReason,
    required this.clientCapturedAt,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'visit_id': visitId,
        'worker_id': workerId,
        'latitude': latitude,
        'longitude': longitude,
        'accuracy_meters': accuracyMeters,
        'distance_meters': distanceMeters,
        'verification_result': verificationResult.toDbCode(),
        'is_exception': isException,
        'exception_reason': exceptionReason,
        'client_captured_at': clientCapturedAt.toUtc().toIso8601String(),
      };

  factory VisitCheckinModel.fromJson(Map<String, dynamic> json) =>
      VisitCheckinModel(
        id: json['id'] as String,
        visitId: json['visit_id'] as String,
        workerId: json['worker_id'] as String,
        latitude: (json['latitude'] as num).toDouble(),
        longitude: (json['longitude'] as num).toDouble(),
        accuracyMeters: (json['accuracy_meters'] as num).toDouble(),
        distanceMeters: (json['distance_meters'] as num).toDouble(),
        verificationResult: LocationVerificationResult.fromString(
            json['verification_result'] as String? ?? 'VALID'),
        isException: json['is_exception'] as bool? ?? false,
        exceptionReason: json['exception_reason'] as String?,
        clientCapturedAt: DateTime.parse(json['client_captured_at'] as String),
      );
}

@immutable
class VisitCheckoutModel {
  final String id;
  final String visitId;
  final String workerId;
  final double latitude;
  final double longitude;
  final double accuracyMeters;
  final String? notes;
  final DateTime clientCapturedAt;

  const VisitCheckoutModel({
    required this.id,
    required this.visitId,
    required this.workerId,
    required this.latitude,
    required this.longitude,
    required this.accuracyMeters,
    this.notes,
    required this.clientCapturedAt,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'visit_id': visitId,
        'worker_id': workerId,
        'latitude': latitude,
        'longitude': longitude,
        'accuracy_meters': accuracyMeters,
        'notes': notes,
        'client_captured_at': clientCapturedAt.toUtc().toIso8601String(),
      };

  factory VisitCheckoutModel.fromJson(Map<String, dynamic> json) =>
      VisitCheckoutModel(
        id: json['id'] as String,
        visitId: json['visit_id'] as String,
        workerId: json['worker_id'] as String,
        latitude: (json['latitude'] as num).toDouble(),
        longitude: (json['longitude'] as num).toDouble(),
        accuracyMeters: (json['accuracy_meters'] as num).toDouble(),
        notes: json['notes'] as String?,
        clientCapturedAt: DateTime.parse(json['client_captured_at'] as String),
      );
}

@immutable
class VisitProofModel {
  final String id;
  final String visitId;
  final String? taskId;
  final ProofType proofType;
  final String? storagePath;
  final String? fileName;
  final String? mimeType;
  final int? fileSizeBytes;
  final String? notes;
  final String? signerName;
  final DateTime createdAt;

  const VisitProofModel({
    required this.id,
    required this.visitId,
    this.taskId,
    required this.proofType,
    this.storagePath,
    this.fileName,
    this.mimeType,
    this.fileSizeBytes,
    this.notes,
    this.signerName,
    required this.createdAt,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'visit_id': visitId,
        'task_id': taskId,
        'proof_type': proofType.toDbCode(),
        'storage_path': storagePath,
        'file_name': fileName,
        'mime_type': mimeType,
        'file_size_bytes': fileSizeBytes,
        'notes': notes,
        'signer_name': signerName,
        'created_at': createdAt.toUtc().toIso8601String(),
      };

  factory VisitProofModel.fromJson(Map<String, dynamic> json) =>
      VisitProofModel(
        id: json['id'] as String,
        visitId: json['visit_id'] as String,
        taskId: json['task_id'] as String?,
        proofType: ProofType.fromString(json['proof_type'] as String? ?? 'PHOTO'),
        storagePath: json['storage_path'] as String?,
        fileName: json['file_name'] as String?,
        mimeType: json['mime_type'] as String?,
        fileSizeBytes: json['file_size_bytes'] as int?,
        notes: json['notes'] as String?,
        signerName: json['signer_name'] as String?,
        createdAt: DateTime.parse(json['created_at'] as String),
      );
}

@immutable
class VisitActivityModel {
  final String id;
  final String visitId;
  final String actorId;
  final String action;
  final Map<String, dynamic> details;
  final DateTime createdAt;

  const VisitActivityModel({
    required this.id,
    required this.visitId,
    required this.actorId,
    required this.action,
    required this.details,
    required this.createdAt,
  });

  factory VisitActivityModel.fromJson(Map<String, dynamic> json) =>
      VisitActivityModel(
        id: json['id'] as String,
        visitId: json['visit_id'] as String,
        actorId: json['actor_id'] as String,
        action: json['action'] as String,
        details: json['details'] as Map<String, dynamic>? ?? {},
        createdAt: DateTime.parse(json['created_at'] as String),
      );
}

@immutable
class VisitModel {
  final String id;
  final String organizationId;
  final String locationId;
  final String? taskId;
  final String? assignedTo;
  final DateTime scheduledStart;
  final DateTime? scheduledEnd;
  final VisitStatus status;
  final int version;
  final LocationModel? location;
  final VisitCheckinModel? checkin;
  final VisitCheckoutModel? checkout;
  final List<VisitProofModel> proofs;

  const VisitModel({
    required this.id,
    required this.organizationId,
    required this.locationId,
    this.taskId,
    this.assignedTo,
    required this.scheduledStart,
    this.scheduledEnd,
    this.status = VisitStatus.scheduled,
    this.version = 1,
    this.location,
    this.checkin,
    this.checkout,
    this.proofs = const [],
  });

  bool get isOverdue {
    if (status == VisitStatus.completed || status == VisitStatus.canceled) {
      return false;
    }
    final cutoff = scheduledEnd ?? scheduledStart;
    return DateTime.now().isAfter(cutoff);
  }

  VisitModel copyWith({
    String? id,
    String? organizationId,
    String? locationId,
    String? taskId,
    String? assignedTo,
    DateTime? scheduledStart,
    DateTime? scheduledEnd,
    VisitStatus? status,
    int? version,
    LocationModel? location,
    VisitCheckinModel? checkin,
    VisitCheckoutModel? checkout,
    List<VisitProofModel>? proofs,
  }) {
    return VisitModel(
      id: id ?? this.id,
      organizationId: organizationId ?? this.organizationId,
      locationId: locationId ?? this.locationId,
      taskId: taskId ?? this.taskId,
      assignedTo: assignedTo ?? this.assignedTo,
      scheduledStart: scheduledStart ?? this.scheduledStart,
      scheduledEnd: scheduledEnd ?? this.scheduledEnd,
      status: status ?? this.status,
      version: version ?? this.version,
      location: location ?? this.location,
      checkin: checkin ?? this.checkin,
      checkout: checkout ?? this.checkout,
      proofs: proofs ?? this.proofs,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'organization_id': organizationId,
        'location_id': locationId,
        'task_id': taskId,
        'assigned_to': assignedTo,
        'scheduled_start': scheduledStart.toUtc().toIso8601String(),
        'scheduled_end': scheduledEnd?.toUtc().toIso8601String(),
        'status': status.toDbCode(),
        'version': version,
        'location': location?.toJson(),
        'checkin': checkin?.toJson(),
        'checkout': checkout?.toJson(),
        'proofs': proofs.map((p) => p.toJson()).toList(),
      };

  factory VisitModel.fromJson(Map<String, dynamic> json) => VisitModel(
        id: json['id'] as String,
        organizationId: json['organization_id'] as String,
        locationId: json['location_id'] as String,
        taskId: json['task_id'] as String?,
        assignedTo: json['assigned_to'] as String?,
        scheduledStart: DateTime.parse(json['scheduled_start'] as String),
        scheduledEnd: json['scheduled_end'] != null
            ? DateTime.parse(json['scheduled_end'] as String)
            : null,
        status: VisitStatus.fromString(json['status'] as String? ?? 'SCHEDULED'),
        version: json['version'] as int? ?? 1,
        location: json['location'] != null
            ? LocationModel.fromJson(json['location'] as Map<String, dynamic>)
            : null,
        checkin: json['checkin'] != null
            ? VisitCheckinModel.fromJson(json['checkin'] as Map<String, dynamic>)
            : null,
        checkout: json['checkout'] != null
            ? VisitCheckoutModel.fromJson(json['checkout'] as Map<String, dynamic>)
            : null,
        proofs: json['proofs'] != null
            ? (json['proofs'] as List<dynamic>)
                .map((p) => VisitProofModel.fromJson(p as Map<String, dynamic>))
                .toList()
            : const [],
      );
}
