import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import LineChartSimple from "@/features/admin/components/LineChartSimple.vue";

describe("LineChartSimple", () => {
  it("shows tooltip on point hover and hides on leave", async () => {
    const wrapper = mount(LineChartSimple, {
      props: {
        title: "Logins",
        points: [
          { label: "10:00", value: 3 },
          { label: "11:00", value: 7 },
        ],
      },
    });

    const hitArea = wrapper.get("[data-testid='chart-point-hit-0']");
    await hitArea.trigger("mouseenter");

    const tooltip = wrapper.get("[data-testid='chart-tooltip']");
    expect(tooltip.text()).toContain("10:00");
    expect(tooltip.text()).toContain("Logins: 3");
    expect(wrapper.get("[data-testid='chart-point-0']").classes()).toContain("pointer-events-none");

    await hitArea.trigger("mouseleave");
    expect(wrapper.find("[data-testid='chart-tooltip']").exists()).toBe(false);
  });
});
