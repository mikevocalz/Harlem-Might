// Host ownership fixture, not a Fabric emulator. The verifier inserts the
// installed production adopt(), state class, and RN getter implementations.
#include <cassert>
#include <memory>
#include <utility>

#define react_native_assert(condition) assert(condition)

namespace react {
struct Props {
  using Shared = std::shared_ptr<const Props>;
  virtual ~Props() = default;
};
class ShadowNode {
 public:
  const Props::Shared& getProps() const;
  Props::Shared props_;
};
/* INSERT_RN_GET_PROPS */
} // namespace react

struct HybridRiveViewProps final : react::Props {
  explicit HybridRiveViewProps(int& destructions) : destructions(destructions) {}
  HybridRiveViewProps(const HybridRiveViewProps&) = delete;
  HybridRiveViewProps& operator=(const HybridRiveViewProps&) = delete;
  ~HybridRiveViewProps() override { ++destructions; }
  int& destructions;
};

/* INSERT_RIVE_STATE */

template <class PropsT>
class FixtureShadowNode : public react::ShadowNode {
 public:
  using ConcreteProps = PropsT;
  using BaseShadowNodeT = react::ShadowNode;
  /* INSERT_RN_UNSAFE_GETTER */
  void setStateData(HybridRiveViewState&& next) { state = std::move(next); }
  HybridRiveViewState state;
};
using HybridRiveViewShadowNode = FixtureShadowNode<HybridRiveViewProps>;

class HybridRiveViewComponentDescriptor {
 public:
  void adopt(react::ShadowNode& shadowNode) const;
};
/* INSERT_RIVE_ADOPT */

int main() {
  HybridRiveViewComponentDescriptor descriptor;
  for (int iteration = 0; iteration < 1000; ++iteration) {
    int firstDestroyed = 0;
    int secondDestroyed = 0;
    std::weak_ptr<const HybridRiveViewProps> firstWeak;
    std::weak_ptr<const HybridRiveViewProps> secondWeak;
    HybridRiveViewState retainedState;
    {
      HybridRiveViewShadowNode node;
      {
        auto first = std::make_shared<HybridRiveViewProps>(firstDestroyed);
        firstWeak = first;
        node.props_ = first;
      }
      // Only the node owns the props before adopt. The state must keep that
      // exact object alive after all temporary shared_ptr handles disappear.
      assert(firstWeak.use_count() == 1);
      descriptor.adopt(node);
      assert(firstWeak.use_count() == 2);
      assert(node.state.getProps().get() == node.getProps().get());
      {
        auto clone = node;
        descriptor.adopt(clone);
        assert(clone.state.getProps().get() == node.state.getProps().get());
        assert(firstWeak.use_count() == 4);
        auto second = std::make_shared<HybridRiveViewProps>(secondDestroyed);
        secondWeak = second;
        clone.props_ = second;
        second.reset();
        descriptor.adopt(clone);
        assert(clone.state.getProps().get() == clone.getProps().get());
        assert(clone.state.getProps().get() != node.state.getProps().get());
        assert(firstWeak.use_count() == 2);
        assert(secondWeak.use_count() == 2);
        retainedState = clone.state;
      }
      assert(secondWeak.use_count() == 1);
      assert(secondDestroyed == 0);
      node.props_.reset();
      assert(firstWeak.use_count() == 1);
      assert(firstDestroyed == 0);
    }
    assert(firstWeak.expired());
    assert(firstDestroyed == 1);
    assert(!secondWeak.expired());
    retainedState = HybridRiveViewState{};
    assert(secondWeak.expired());
    assert(secondDestroyed == 1);
  }
}
