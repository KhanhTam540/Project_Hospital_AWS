import 'package:flutter/material.dart';

import '../../models/api_resource_definition.dart';
import 'api_resource_screen.dart';

class ScheduleScreen extends StatefulWidget {
  const ScheduleScreen({super.key});

  @override
  State<ScheduleScreen> createState() => _ScheduleScreenState();
}

class _ScheduleScreenState extends State<ScheduleScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
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
            tabs: const [
              Tab(
                icon: Icon(Icons.event_available_rounded),
                text: 'Lịch làm việc',
              ),
              Tab(
                icon: Icon(Icons.access_time_filled_rounded),
                text: 'Ca trực',
              ),
            ],
          ),
        ),
        Expanded(
          child: TabBarView(
            controller: _tabController,
            children: [
              ApiResourceScreen(definition: ApiResources.schedules),
              ApiResourceScreen(definition: ApiResources.shifts),
            ],
          ),
        ),
      ],
    );
  }
}
