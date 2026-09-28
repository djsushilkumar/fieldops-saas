import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Representation of network connectivity status.
enum NetworkStatus { online, offline }

abstract class ConnectivityService {
  NetworkStatus get currentStatus;
  Stream<NetworkStatus> get onStatusChanged;
  bool get isOnline => currentStatus == NetworkStatus.online;
}

/// Fallback / mock connectivity service for architecture foundation.
class MockConnectivityService implements ConnectivityService {
  final _controller = StreamController<NetworkStatus>.broadcast();
  NetworkStatus _status = NetworkStatus.online;

  @override
  NetworkStatus get currentStatus => _status;

  @override
  Stream<NetworkStatus> get onStatusChanged => _controller.stream;

  @override
  bool get isOnline => _status == NetworkStatus.online;

  void setStatus(NetworkStatus status) {
    _status = status;
    _controller.add(status);
  }

  void dispose() {
    _controller.close();
  }
}

final connectivityServiceProvider = Provider<ConnectivityService>((ref) {
  return MockConnectivityService();
});

final isOnlineProvider = StreamProvider<bool>((ref) {
  final service = ref.watch(connectivityServiceProvider);
  return service.onStatusChanged.map((status) => status == NetworkStatus.online);
});
