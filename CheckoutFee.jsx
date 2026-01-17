import { reactExtension, useApplyCartLinesChange, BlockStack, Text, Divider, InlineStack } from '@shopify/ui-extensions-react/checkout';

export default reactExtension('purchase.checkout.block.render', () => <CheckoutFee />);

function CheckoutFee() {
  const { checkout } = useApplyCartLinesChange();
  
  // 检测美国地址
  const shippingAddress = checkout?.shippingAddress;
  const isUS = shippingAddress?.countryCode === 'US';
  
  if (!isUS) {
    return null; // 非美国地址不显示
  }
  
  // 计算费用
  const subtotal = checkout?.subtotalPrice?.amount || '0';
  const subtotalNum = parseFloat(subtotal);
  const tax = (subtotalNum * 0.08).toFixed(2);
  const insurance = (subtotalNum * 0.02).toFixed(2);
  const total = (subtotalNum + parseFloat(tax) + parseFloat(insurance)).toFixed(2);
  
  return (
    <BlockStack spacing="base" padding="base" cornerRadius="base" border="base" borderColor="base">
      <InlineStack spacing="base" alignment="center">
        <Text size="large" emphasis="bold">🇺🇸 美国地区额外费用</Text>
      </InlineStack>
      
      <Divider />
      
      <BlockStack spacing="tight">
        <InlineStack spacing="base" alignment="center" blockAlignment="center">
          <Text appearance="subdued">订单金额:</Text>
          <Text emphasis="bold">${subtotal}</Text>
        </InlineStack>
        
        <InlineStack spacing="base" alignment="center" blockAlignment="center">
          <Text appearance="subdued">税费 (8%):</Text>
          <Text color="success" emphasis="bold">+ ${tax}</Text>
        </InlineStack>
        
        <InlineStack spacing="base" alignment="center" blockAlignment="center">
          <Text appearance="subdued">保险费 (2%):</Text>
          <Text color="success" emphasis="bold">+ ${insurance}</Text>
        </InlineStack>
        
        <Divider />
        
        <InlineStack spacing="base" alignment="center" blockAlignment="center">
          <Text size="large" emphasis="bold">订单总计:</Text>
          <Text size="large" emphasis="bold" appearance="success">${total}</Text>
        </InlineStack>
      </BlockStack>
      
      <Text size="small" appearance="subdued" alignment="center">
        仅美国地区适用：8%销售税 + 2%保险费
      </Text>
    </BlockStack>
  );
}
