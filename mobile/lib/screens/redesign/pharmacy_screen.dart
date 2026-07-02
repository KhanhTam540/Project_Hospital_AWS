import 'package:flutter/material.dart';

import '../../models/api_resource_definition.dart';
import 'api_resource_screen.dart';

class PharmacyScreen extends StatefulWidget {
  const PharmacyScreen({super.key});

  @override
  State<PharmacyScreen> createState() => _PharmacyScreenState();
}

class _PharmacyScreenState extends State<PharmacyScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
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
              Tab(icon: Icon(Icons.medication_rounded), text: 'Thuốc'),
              Tab(icon: Icon(Icons.category_rounded), text: 'Nhóm thuốc'),
              Tab(icon: Icon(Icons.straighten_rounded), text: 'Đơn vị tính'),
            ],
          ),
        ),
        Expanded(
          child: TabBarView(
            controller: _tabController,
            children: [
              ApiResourceScreen(definition: ApiResources.medicines),
              ApiResourceScreen(definition: ApiResources.medicineGroups),
              ApiResourceScreen(definition: ApiResources.medicineUnits),
            ],
          ),
        ),
      ],
    );
  }
}
