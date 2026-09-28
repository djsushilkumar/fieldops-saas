import 'package:flutter/foundation.dart';

enum AttendanceStatus {
  clockedIn,
  onBreak,
  clockedOut,
  corrected;

  static AttendanceStatus fromDb(String val) {
    switch (val.toUpperCase()) {
      case 'CLOCKED_IN':
      case 'CHECKED_IN':
        return AttendanceStatus.clockedIn;
      case 'ON_BREAK':
        return AttendanceStatus.onBreak;
      case 'CLOCKED_OUT':
      case 'CHECKED_OUT':
        return AttendanceStatus.clockedOut;
      case 'CORRECTED':
        return AttendanceStatus.corrected;
      default:
        return AttendanceStatus.clockedIn;
    }
  }

  String toDbCode() {
    switch (this) {
      case AttendanceStatus.clockedIn:
        return 'CLOCKED_IN';
      case AttendanceStatus.onBreak:
        return 'ON_BREAK';
      case AttendanceStatus.clockedOut:
        return 'CLOCKED_OUT';
      case AttendanceStatus.corrected:
        return 'CORRECTED';
    }
  }

  String get displayName {
    switch (this) {
      case AttendanceStatus.clockedIn:
        return 'Clocked In';
      case AttendanceStatus.onBreak:
        return 'On Break';
      case AttendanceStatus.clockedOut:
        return 'Clocked Out';
      case AttendanceStatus.corrected:
        return 'Corrected';
    }
  }
}

@immutable
class AttendanceRecordModel {
  final String id;
  final String organizationId;
  final String userId;
  final String date;
  final DateTime checkInAt;
  final DateTime? checkOutAt;
  final double? checkInLatitude;
  final double? checkInLongitude;
  final double? checkInAccuracyMeters;
  final double? checkOutLatitude;
  final double? checkOutLongitude;
  final double? checkOutAccuracyMeters;
  final AttendanceStatus status;
  final int? durationSeconds;
  final String? notes;
  final bool isManuallyAdjusted;
  final String? adjustmentReason;
  final String? adjustedByUserId;
  final DateTime? adjustedAt;

  const AttendanceRecordModel({
    required this.id,
    required this.organizationId,
    required this.userId,
    required this.date,
    required this.checkInAt,
    this.checkOutAt,
    this.checkInLatitude,
    this.checkInLongitude,
    this.checkInAccuracyMeters,
    this.checkOutLatitude,
    this.checkOutLongitude,
    this.checkOutAccuracyMeters,
    required this.status,
    this.durationSeconds,
    this.notes,
    this.isManuallyAdjusted = false,
    this.adjustmentReason,
    this.adjustedByUserId,
    this.adjustedAt,
  });

  bool get isActive =>
      status == AttendanceStatus.clockedIn || status == AttendanceStatus.onBreak;

  bool get isCompleted =>
      status == AttendanceStatus.clockedOut || status == AttendanceStatus.corrected;

  int calculateCurrentDurationSeconds([DateTime? now]) {
    if (durationSeconds != null) return durationSeconds!;
    final referenceTime = now ?? DateTime.now().toUtc();
    final diff = referenceTime.difference(checkInAt).inSeconds;
    return diff > 0 ? diff : 0;
  }

  String get formattedDuration {
    final seconds = durationSeconds ?? calculateCurrentDurationSeconds();
    final hours = seconds ~/ 3600;
    final minutes = (seconds % 3600) ~/ 60;
    if (hours == 0) return '${minutes}m';
    return '${hours}h ${minutes}m';
  }

  AttendanceRecordModel copyWith({
    String? id,
    String? organizationId,
    String? userId,
    String? date,
    DateTime? checkInAt,
    DateTime? checkOutAt,
    double? checkInLatitude,
    double? checkInLongitude,
    double? checkInAccuracyMeters,
    double? checkOutLatitude,
    double? checkOutLongitude,
    double? checkOutAccuracyMeters,
    AttendanceStatus? status,
    int? durationSeconds,
    String? notes,
    bool? isManuallyAdjusted,
    String? adjustmentReason,
    String? adjustedByUserId,
    DateTime? adjustedAt,
  }) {
    return AttendanceRecordModel(
      id: id ?? this.id,
      organizationId: organizationId ?? this.organizationId,
      userId: userId ?? this.userId,
      date: date ?? this.date,
      checkInAt: checkInAt ?? this.checkInAt,
      checkOutAt: checkOutAt ?? this.checkOutAt,
      checkInLatitude: checkInLatitude ?? this.checkInLatitude,
      checkInLongitude: checkInLongitude ?? this.checkInLongitude,
      checkInAccuracyMeters: checkInAccuracyMeters ?? this.checkInAccuracyMeters,
      checkOutLatitude: checkOutLatitude ?? this.checkOutLatitude,
      checkOutLongitude: checkOutLongitude ?? this.checkOutLongitude,
      checkOutAccuracyMeters: checkOutAccuracyMeters ?? this.checkOutAccuracyMeters,
      status: status ?? this.status,
      durationSeconds: durationSeconds ?? this.durationSeconds,
      notes: notes ?? this.notes,
      isManuallyAdjusted: isManuallyAdjusted ?? this.isManuallyAdjusted,
      adjustmentReason: adjustmentReason ?? this.adjustmentReason,
      adjustedByUserId: adjustedByUserId ?? this.adjustedByUserId,
      adjustedAt: adjustedAt ?? this.adjustedAt,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'organization_id': organizationId,
      'user_id': userId,
      'date': date,
      'check_in_at': checkInAt.toIso8601String(),
      'check_out_at': checkOutAt?.toIso8601String(),
      'check_in_latitude': checkInLatitude,
      'check_in_longitude': checkInLongitude,
      'check_in_accuracy_meters': checkInAccuracyMeters,
      'check_out_latitude': checkOutLatitude,
      'check_out_longitude': checkOutLongitude,
      'check_out_accuracy_meters': checkOutAccuracyMeters,
      'status': status.toDbCode(),
      'duration_seconds': durationSeconds,
      'notes': notes,
      'is_manually_adjusted': isManuallyAdjusted,
      'adjustment_reason': adjustmentReason,
      'adjusted_by_user_id': adjustedByUserId,
      'adjusted_at': adjustedAt?.toIso8601String(),
    };
  }

  factory AttendanceRecordModel.fromJson(Map<String, dynamic> json) {
    return AttendanceRecordModel(
      id: json['id'] as String,
      organizationId: (json['organization_id'] ?? json['organizationId']) as String,
      userId: (json['user_id'] ?? json['userId']) as String,
      date: json['date'] as String,
      checkInAt: DateTime.parse((json['check_in_at'] ?? json['checkInAt']) as String),
      checkOutAt: json['check_out_at'] != null || json['checkOutAt'] != null
          ? DateTime.parse((json['check_out_at'] ?? json['checkOutAt']) as String)
          : null,
      checkInLatitude: (json['check_in_latitude'] ?? json['checkInLatitude'] as num?)?.toDouble(),
      checkInLongitude: (json['check_in_longitude'] ?? json['checkInLongitude'] as num?)?.toDouble(),
      checkInAccuracyMeters: (json['check_in_accuracy_meters'] ?? json['checkInAccuracyMeters'] as num?)?.toDouble(),
      checkOutLatitude: (json['check_out_latitude'] ?? json['checkOutLatitude'] as num?)?.toDouble(),
      checkOutLongitude: (json['check_out_longitude'] ?? json['checkOutLongitude'] as num?)?.toDouble(),
      checkOutAccuracyMeters: (json['check_out_accuracy_meters'] ?? json['checkOutAccuracyMeters'] as num?)?.toDouble(),
      status: AttendanceStatus.fromDb((json['status'] ?? 'CLOCKED_IN') as String),
      durationSeconds: (json['duration_seconds'] ?? json['durationSeconds'] as num?)?.toInt(),
      notes: json['notes'] as String?,
      isManuallyAdjusted: (json['is_manually_adjusted'] ?? json['isManuallyAdjusted'] as bool?) ?? false,
      adjustmentReason: (json['adjustment_reason'] ?? json['adjustmentReason']) as String?,
      adjustedByUserId: (json['adjusted_by_user_id'] ?? json['adjustedByUserId']) as String?,
      adjustedAt: json['adjusted_at'] != null || json['adjustedAt'] != null
          ? DateTime.parse((json['adjusted_at'] ?? json['adjustedAt']) as String)
          : null,
    );
  }
}

@immutable
class WorkerActivityModel {
  final String id;
  final String organizationId;
  final String userId;
  final String activityType;
  final String title;
  final String? description;
  final Map<String, dynamic> metadata;
  final DateTime createdAt;

  const WorkerActivityModel({
    required this.id,
    required this.organizationId,
    required this.userId,
    required this.activityType,
    required this.title,
    this.description,
    required this.metadata,
    required this.createdAt,
  });

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'organization_id': organizationId,
      'user_id': userId,
      'activity_type': activityType,
      'title': title,
      'description': description,
      'metadata': metadata,
      'created_at': createdAt.toIso8601String(),
    };
  }

  factory WorkerActivityModel.fromJson(Map<String, dynamic> json) {
    return WorkerActivityModel(
      id: json['id'] as String,
      organizationId: (json['organization_id'] ?? json['organizationId']) as String,
      userId: (json['user_id'] ?? json['userId']) as String,
      activityType: (json['activity_type'] ?? json['activityType']) as String,
      title: json['title'] as String,
      description: json['description'] as String?,
      metadata: (json['metadata'] as Map<String, dynamic>?) ?? {},
      createdAt: DateTime.parse((json['created_at'] ?? json['createdAt']) as String),
    );
  }
}
