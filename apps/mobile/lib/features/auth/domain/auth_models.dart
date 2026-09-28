/// Explicit authentication lifecycle states per Phase 03 architecture.
enum AuthState {
  unknown,
  authenticating,
  authenticated,
  unauthenticated,
  sessionExpired,
  authError,
}

class UserProfile {
  final String id;
  final String email;
  final String fullName;
  final String? phone;
  final String timezone;

  const UserProfile({
    required this.id,
    required this.email,
    required this.fullName,
    this.phone,
    required this.timezone,
  });

  factory UserProfile.fromJson(Map<String, dynamic> json) {
    return UserProfile(
      id: json['id'] as String,
      email: json['email'] as String,
      fullName: json['fullName'] as String? ?? json['full_name'] as String? ?? '',
      phone: json['phone'] as String?,
      timezone: json['timezone'] as String? ?? 'UTC',
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'email': email,
    'fullName': fullName,
    'phone': phone,
    'timezone': timezone,
  };
}

class Organization {
  final String id;
  final String name;
  final String slug;
  final String subscriptionTier;

  const Organization({
    required this.id,
    required this.name,
    required this.slug,
    required this.subscriptionTier,
  });

  factory Organization.fromJson(Map<String, dynamic> json) {
    return Organization(
      id: json['id'] as String,
      name: json['name'] as String,
      slug: json['slug'] as String,
      subscriptionTier: json['subscriptionTier'] as String? ?? json['subscription_tier'] as String? ?? 'TRIAL',
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'slug': slug,
    'subscriptionTier': subscriptionTier,
  };
}

class Membership {
  final String id;
  final String organizationId;
  final String userId;
  final String role;
  final String status;
  final Organization? organization;

  const Membership({
    required this.id,
    required this.organizationId,
    required this.userId,
    required this.role,
    required this.status,
    this.organization,
  });

  factory Membership.fromJson(Map<String, dynamic> json) {
    return Membership(
      id: json['id'] as String,
      organizationId: json['organizationId'] as String? ?? json['organization_id'] as String,
      userId: json['userId'] as String? ?? json['user_id'] as String,
      role: json['role'] as String,
      status: json['status'] as String? ?? 'ACTIVE',
      organization: json['organization'] != null
          ? Organization.fromJson(json['organization'] as Map<String, dynamic>)
          : null,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'organizationId': organizationId,
    'userId': userId,
    'role': role,
    'status': status,
    'organization': organization?.toJson(),
  };
}

class AuthTokens {
  final String accessToken;
  final String? refreshToken;
  final int expiresIn;

  const AuthTokens({
    required this.accessToken,
    this.refreshToken,
    required this.expiresIn,
  });

  factory AuthTokens.fromJson(Map<String, dynamic> json) {
    return AuthTokens(
      accessToken: json['accessToken'] as String? ?? json['access_token'] as String,
      refreshToken: json['refreshToken'] as String? ?? json['refresh_token'] as String?,
      expiresIn: json['expiresIn'] as int? ?? json['expires_in'] as int? ?? 3600,
    );
  }

  Map<String, dynamic> toJson() => {
    'accessToken': accessToken,
    'refreshToken': refreshToken,
    'expiresIn': expiresIn,
  };
}

class AuthSession {
  final UserProfile user;
  final AuthTokens tokens;
  final Membership? activeMembership;
  final List<Membership> memberships;

  const AuthSession({
    required this.user,
    required this.tokens,
    this.activeMembership,
    this.memberships = const [],
  });

  factory AuthSession.fromJson(Map<String, dynamic> json) {
    final rawMemberships = json['availableMemberships'] as List<dynamic>? ??
        json['memberships'] as List<dynamic>? ??
        [];

    final membershipsList = rawMemberships
        .map((m) => Membership.fromJson(m as Map<String, dynamic>))
        .toList();

    return AuthSession(
      user: UserProfile.fromJson(json['user'] as Map<String, dynamic>),
      tokens: AuthTokens.fromJson(json['tokens'] as Map<String, dynamic>),
      activeMembership: json['activeMembership'] != null
          ? Membership.fromJson(json['activeMembership'] as Map<String, dynamic>)
          : (membershipsList.isNotEmpty ? membershipsList.first : null),
      memberships: membershipsList,
    );
  }
}
