import { Container, Text, Title } from '@mantine/core'
import { createBrowserRouter } from 'react-router'

export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <Container py="xl">
        <Title order={1}>Formularze medyczne</Title>
        <Text c="dimmed">Szkielet aplikacji — ekrany powstaną w kolejnych etapach.</Text>
      </Container>
    ),
  },
  {
    path: '*',
    element: (
      <Container py="xl">
        <Title order={2}>Nie znaleziono strony</Title>
      </Container>
    ),
  },
])
