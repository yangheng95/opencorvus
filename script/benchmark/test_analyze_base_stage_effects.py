import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from analyze_base_stage_effects import aggregate_model_calls, assign_event_agents, phase_boundaries, tool_intervals


class BaseStageAnalysisTest(unittest.TestCase):
    def test_model_calls_sum_multiple_sessions_owned_by_one_agent(self):
        self.assertEqual(
            aggregate_model_calls([
                {"session_id": "first", "agent_id": "base-developer", "modelCalls": 5},
                {"session_id": "second", "agent_id": "base-developer", "modelCalls": 7},
            ]),
            {"base-developer": 12},
        )

    def test_real_tool_time_contract_assigns_role_boundaries(self):
        transcripts = [
            {
                "transcript": [
                    {
                        "info": {"agentID": "base-developer"},
                        "parts": [
                            {"type": "tool", "tool": "bash", "state": {"time": {"start": 100, "end": 200}}}
                        ],
                    },
                    {
                        "info": {"agentID": "base-tester"},
                        "parts": [
                            {"type": "tool", "tool": "bash", "state": {"time": {"start": 300, "end": 400}}}
                        ],
                    },
                ]
            }
        ]
        events = [
            {"kind": "tool", "start": 120},
            {"kind": "tool", "start": 180},
            {"kind": "tool", "start": 320},
        ]
        assigned = assign_event_agents(events, tool_intervals(transcripts), tolerance_ms=0)
        self.assertEqual(assigned, ["base-developer", "base-developer", "base-tester"])
        self.assertEqual(phase_boundaries(assigned), [(1, "base-developer"), (2, "base-tester")])


if __name__ == "__main__":
    unittest.main()
