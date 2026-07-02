import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../services/api_client.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_components.dart';
import 'lich_hen_bn_screen.dart';

class LichHenDetailScreen extends StatefulWidget {
  const LichHenDetailScreen({
    super.key,
    required this.maLich,
  });

  final String maLich;

  @override
  State<LichHenDetailScreen> createState() => _LichHenDetailScreenState();
}

class _LichHenDetailScreenState extends State<LichHenDetailScreen> {
  final ApiClient _api = ApiClient();
  LichHenModel? _appointment;
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final response = await _api.get('/lichkham/${widget.maLich}');
      final data = Map<String, dynamic>.from(_api.dataOf(response) as Map);
      if (!mounted) return;
      setState(() => _appointment = LichHenModel.fromJson(data));
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = 'Không tải được lịch khám: $error');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Chi tiết lịch khám'),
        leading: IconButton(
          onPressed: () => context.go('/patient/lich'),
          icon: const Icon(Icons.arrow_back),
        ),
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(18),
          children: [
            if (_isLoading)
              const Padding(
                padding: EdgeInsets.all(42),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_error != null)
              AppCard(
                child: Row(
                  children: [
                    const Icon(Icons.error_outline, color: AppTheme.danger),
                    const SizedBox(width: 12),
                    Expanded(child: Text(_error!)),
                  ],
                ),
              )
            else if (_appointment != null)
              _AppointmentDetail(appointment: _appointment!),
          ],
        ),
      ),
    );
  }
}

class _AppointmentDetail extends StatelessWidget {
  const _AppointmentDetail({required this.appointment});

  final LichHenModel appointment;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                appointment.tenBS,
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              const SizedBox(height: 16),
              _DetailRow(
                icon: Icons.badge_outlined,
                label: 'Mã lịch',
                value: appointment.maLich,
              ),
              _DetailRow(
                icon: Icons.calendar_month_outlined,
                label: 'Ngày khám',
                value: DateFormat('dd/MM/yyyy').format(appointment.ngayKham),
              ),
              _DetailRow(
                icon: Icons.schedule_outlined,
                label: 'Giờ khám',
                value: appointment.gioKham,
              ),
              _DetailRow(
                icon: Icons.info_outline,
                label: 'Trạng thái',
                value: appointment.trangThai,
              ),
              if (appointment.soThuTu != null)
                _DetailRow(
                  icon: Icons.format_list_numbered,
                  label: 'Số thứ tự',
                  value: appointment.soThuTu.toString(),
                ),
              if (appointment.phong.isNotEmpty)
                _DetailRow(
                  icon: Icons.meeting_room_outlined,
                  label: 'Phòng khám',
                  value: appointment.phong,
                ),
              if (appointment.ghiChu.isNotEmpty)
                _DetailRow(
                  icon: Icons.notes_outlined,
                  label: 'Ghi chú',
                  value: appointment.ghiChu,
                ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        const AppCard(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.health_and_safety_outlined, color: AppTheme.teal),
              SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Vui lòng đến trước giờ hẹn 15 phút và mang theo giấy tờ tùy thân, thẻ BHYT nếu có.',
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 20, color: Theme.of(context).colorScheme.primary),
          const SizedBox(width: 12),
          SizedBox(
            width: 100,
            child: Text(label, style: Theme.of(context).textTheme.bodyMedium),
          ),
          Expanded(
            child: Text(
              value.isEmpty ? 'Chưa cập nhật' : value,
              style: Theme.of(context).textTheme.bodyLarge,
            ),
          ),
        ],
      ),
    );
  }
}
