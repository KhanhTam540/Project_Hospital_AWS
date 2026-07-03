import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../auth/auth_provider.dart';
import '../../models/api_resource_definition.dart';
import 'api_resource_screen.dart';
import 'clinical_workspace_screen.dart';

class ClinicalHubScreen extends StatefulWidget {
  const ClinicalHubScreen({super.key});

  @override
  State<ClinicalHubScreen> createState() => _ClinicalHubScreenState();
}

class _ClinicalHubScreenState extends State<ClinicalHubScreen>
    with SingleTickerProviderStateMixin {
  TabController? _controller;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final auth = context.read<AuthProvider>();
    final length = auth.role == 'BENHNHAN' ? 1 : 5;
    if (_controller?.length != length) {
      _controller?.dispose();
      _controller = TabController(length: length, vsync: this);
    }
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final controller = _controller!;
    if (auth.role == 'BENHNHAN') {
      return const ClinicalWorkspaceScreen();
    }

    final records = ApiResourceDefinition(
      title: 'Bệnh án tương thích',
      subtitle: 'Danh sách từ GET /hsba dành cho các giao diện nghiệp vụ cũ.',
      icon: Icons.folder_shared_rounded,
      endpoint: (_) => '/hsba',
      primaryKeys: const ['maHSBA', 'recordId', 'maBN'],
      secondaryKeys: const ['ngayLap', 'createdAt', 'dotKhamBenh'],
      emptyMessage: 'Chưa có hồ sơ bệnh án tương thích.',
    );
    final exams = ApiResourceDefinition(
      title: 'Phiếu khám tương thích',
      subtitle: 'Danh sách phiếu khám từ GET /phieukham.',
      icon: Icons.medical_information_rounded,
      endpoint: (_) => '/phieukham',
      primaryKeys: const ['maPK', 'examinationId', 'maBN'],
      secondaryKeys: const ['ngayKham', 'diagnosis', 'chuanDoan'],
      emptyMessage: 'Chưa có phiếu khám.',
    );
    final queue = ApiResourceDefinition(
      title: 'Hàng đợi điều dưỡng',
      subtitle: 'Danh sách cần tiếp nhận từ GET /phieukham/nurse/queue.',
      icon: Icons.queue_rounded,
      endpoint: (_) => '/phieukham/nurse/queue',
      primaryKeys: const ['hoTen', 'patientName', 'maPK', 'examinationId'],
      secondaryKeys: const ['soThuTu', 'queueNumber', 'trangThai', 'status'],
      emptyMessage: 'Không có bệnh nhân trong hàng đợi.',
    );
    final prescriptions = ApiResourceDefinition(
      title: 'Đơn thuốc tương thích',
      subtitle: 'Danh sách đơn thuốc từ GET /donthuoc.',
      icon: Icons.medication_liquid_rounded,
      endpoint: (_) => '/donthuoc',
      primaryKeys: const ['maDT', 'prescriptionId', 'maBN'],
      secondaryKeys: const ['ngayKeDon', 'createdAt', 'maBS'],
      emptyMessage: 'Chưa có đơn thuốc.',
    );

    return Column(
      children: [
        Material(
          color: Theme.of(context).colorScheme.surface,
          child: TabBar(
            controller: controller,
            isScrollable: true,
            tabs: const [
              Tab(
                icon: Icon(Icons.health_and_safety_rounded),
                text: 'Theo bệnh nhân',
              ),
              Tab(icon: Icon(Icons.folder_shared_rounded), text: 'Bệnh án'),
              Tab(
                icon: Icon(Icons.medical_information_rounded),
                text: 'Phiếu khám',
              ),
              Tab(icon: Icon(Icons.queue_rounded), text: 'Hàng đợi'),
              Tab(
                icon: Icon(Icons.medication_liquid_rounded),
                text: 'Đơn thuốc',
              ),
            ],
          ),
        ),
        Expanded(
          child: TabBarView(
            controller: controller,
            children: [
              const ClinicalWorkspaceScreen(),
              ApiResourceScreen(definition: records),
              ApiResourceScreen(definition: exams),
              ApiResourceScreen(definition: queue),
              ApiResourceScreen(definition: prescriptions),
            ],
          ),
        ),
      ],
    );
  }
}
