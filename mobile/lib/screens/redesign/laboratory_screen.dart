import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../auth/auth_provider.dart';
import '../../models/api_resource_definition.dart';
import '../../services/hospital_api_service.dart';
import '../../widgets/hospital_ui.dart';
import 'api_resource_screen.dart';

class LaboratoryScreen extends StatefulWidget {
  const LaboratoryScreen({super.key});

  @override
  State<LaboratoryScreen> createState() => _LaboratoryScreenState();
}

class _LaboratoryScreenState extends State<LaboratoryScreen>
    with SingleTickerProviderStateMixin {
  final HospitalApiService _service = HospitalApiService();
  late final TabController _tabController;

  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _results = const [];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadResults());
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadResults() async {
    if (!mounted) return;
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final auth = context.read<AuthProvider>();
      final data = await _service.labResults(
        patientId: auth.role == 'BENHNHAN' ? auth.maBN : null,
      );
      if (!mounted) return;
      setState(() => _results = data);
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _showResult(Map<String, dynamic> item) async {
    final id = firstText(item, const [
      'maPhieuXN',
      'labResultId',
      'id',
    ], fallback: '');
    Map<String, dynamic> detail = item;
    if (id.isNotEmpty) {
      try {
        detail = await _service.labResult(id);
      } catch (_) {
        detail = item;
      }
    }
    if (!mounted) return;
    await showDataDetails(
      context,
      title: firstText(detail, const [
        'tenXetNghiem',
        'testName',
        'maPhieuXN',
      ], fallback: 'Kết quả xét nghiệm'),
      data: detail,
      labels: const {
        'maPhieuXN': 'Mã phiếu',
        'labResultId': 'Mã phiếu',
        'maBN': 'Mã bệnh nhân',
        'patientId': 'Mã bệnh nhân',
        'tenXetNghiem': 'Tên xét nghiệm',
        'testName': 'Tên xét nghiệm',
        'ketQua': 'Kết quả',
        'result': 'Kết quả',
        'donVi': 'Đơn vị',
        'unit': 'Đơn vị',
        'giaTriThamChieu': 'Khoảng tham chiếu',
        'referenceRange': 'Khoảng tham chiếu',
        'ngayThucHien': 'Ngày thực hiện',
        'performedAt': 'Ngày thực hiện',
        'trangThai': 'Trạng thái',
        'status': 'Trạng thái',
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Material(
          color: Theme.of(context).colorScheme.surface,
          child: TabBar(
            controller: _tabController,
            isScrollable: true,
            tabs: const [
              Tab(icon: Icon(Icons.fact_check_rounded), text: 'Kết quả'),
              Tab(icon: Icon(Icons.assignment_rounded), text: 'Yêu cầu'),
              Tab(icon: Icon(Icons.biotech_rounded), text: 'Danh mục'),
            ],
          ),
        ),
        Expanded(
          child: TabBarView(
            controller: _tabController,
            children: [
              HospitalPage(
                onRefresh: _loadResults,
                children: [
                  PageHeader(
                    title: 'Kết quả xét nghiệm',
                    subtitle:
                        'Theo dõi phiếu xét nghiệm và xem thông tin chi tiết.',
                    icon: Icons.science_rounded,
                    badge: const EndpointBadge(
                      method: 'GET',
                      path: '/phieuxetnghiem',
                    ),
                    actions: [
                      OutlinedButton.icon(
                        onPressed: _loading ? null : _loadResults,
                        icon: const Icon(Icons.refresh_rounded),
                        label: const Text('Làm mới'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 22),
                  ResponsiveGrid(
                    children: [
                      MetricCard(
                        label: 'Tổng phiếu',
                        value: '${_results.length}',
                        icon: Icons.description_rounded,
                      ),
                      MetricCard(
                        label: 'Đã hoàn thành',
                        value:
                            '${_results.where((item) {
                              final status = firstText(item, const ['trangThai', 'status'], fallback: '').toUpperCase();
                              return status.contains('HOAN') || status.contains('DONE') || status.contains('COMPLETE');
                            }).length}',
                        icon: Icons.task_alt_rounded,
                        color: Colors.green,
                      ),
                      MetricCard(
                        label: 'Đang xử lý',
                        value:
                            '${_results.where((item) {
                              final status = firstText(item, const ['trangThai', 'status'], fallback: '').toUpperCase();
                              return status.contains('CHO') || status.contains('DANG') || status.contains('PENDING');
                            }).length}',
                        icon: Icons.hourglass_top_rounded,
                        color: Colors.orange,
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  if (_loading)
                    const LoadingState()
                  else if (_error != null)
                    ErrorState(message: _error!, onRetry: _loadResults)
                  else if (_results.isEmpty)
                    const EmptyState(
                      title: 'Chưa có phiếu xét nghiệm',
                      message:
                          'Backend chưa trả về dữ liệu hoặc tài khoản hiện tại chưa có kết quả.',
                      icon: Icons.science_outlined,
                    )
                  else
                    ..._results.map(
                      (item) => Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: DataListTile(
                          title: firstText(item, const [
                            'tenXetNghiem',
                            'testName',
                            'maPhieuXN',
                            'labResultId',
                          ], fallback: 'Phiếu xét nghiệm'),
                          subtitle: firstText(item, const [
                            'ngayThucHien',
                            'performedAt',
                            'maBN',
                            'patientId',
                          ], fallback: 'Nhấn để xem chi tiết'),
                          status: firstText(item, const [
                            'trangThai',
                            'status',
                          ], fallback: ''),
                          icon: Icons.biotech_rounded,
                          onTap: () => _showResult(item),
                        ),
                      ),
                    ),
                ],
              ),
              ApiResourceScreen(definition: ApiResources.labRequests),
              ApiResourceScreen(definition: ApiResources.labCatalog),
            ],
          ),
        ),
      ],
    );
  }
}
